const Media = require('../models/Media');
const User = require('../models/User');
const Tag = require('../models/Tag');
const MediaTag = require('../models/MediaTag');
const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
const s3Client = require('../config/s3');
const { Op } = require('sequelize');
const { generateThumbnail } = require('../utils/thumbnailGenerator');

// POST /media/upload - Upload de nova mídia
async function uploadMedia(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo foi enviado' });
    }

    const usuario = await User.findByPk(req.user.id);

    if (!usuario) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Dados do arquivo (fornecidos pelo multer-s3 e middleware)
    const { title, description, tagUuids } = req.body;

    // Gerar thumbnail
    let thumbnailData = { thumbnail_url: null, thumbnail_s3_key: null };

    try {
      console.log(`Gerando thumbnail para ${req.mediaType}...`);

      thumbnailData = await generateThumbnail({
        mediaType: req.mediaType,
        fileUrl: req.file.location,  // URL S3 do arquivo original
        userUuid: usuario.uuid,
        filename: req.originalFilename,
        metadata: {
          mimetype: req.file.mimetype,
          size: req.file.size
        }
      });

      if (thumbnailData.thumbnail_url) {
        console.log(`✓ Thumbnail gerada: ${thumbnailData.thumbnail_url}`);
      }
    } catch (thumbnailError) {
      // Não bloquear upload se thumbnail falhar
      console.error('⚠ Erro ao gerar thumbnail (não crítico):', thumbnailError.message);
    }

    // Criar registro no banco
    const media = await Media.create({
      type: req.mediaType,
      url: req.file.location,
      s3_key: req.file.key,
      thumbnail_url: thumbnailData.thumbnail_url,
      thumbnail_s3_key: thumbnailData.thumbnail_s3_key,
      userId: usuario.id,
      title: title || null,
      description: description || null,
      filename: req.originalFilename,
      size: req.file.size,
      mimetype: req.file.mimetype
    });

    // Processar tags se fornecidas
    let associatedTags = [];
    if (tagUuids) {
      try {
        const tagIds = JSON.parse(tagUuids);
        if (Array.isArray(tagIds) && tagIds.length > 0) {
          // Buscar tags válidas do usuário
          const tags = await Tag.findAll({
            where: {
              uuid: tagIds,
              userId: usuario.id
            }
          });

          // Criar associações
          const associations = tags.map(tag => ({
            mediaId: media.id,
            tagId: tag.id
          }));

          if (associations.length > 0) {
            await MediaTag.bulkCreate(associations, { ignoreDuplicates: true });
            associatedTags = tags.map(t => t.toJSON());
          }
        }
      } catch (tagError) {
        console.error('Erro ao processar tags:', tagError);
        // Não bloquear upload se tags falharem
      }
    }

    res.status(201).json({
      message: 'Mídia enviada com sucesso!',
      media: {
        ...media.toJSON(),
        tags: associatedTags
      }
    });

  } catch (error) {
    console.error('Erro ao fazer upload de mídia:', error);

    // Se houver erro ao criar no banco, deletar arquivo do S3
    if (req.file && req.file.key) {
      const deleteParams = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: req.file.key
      };
      s3Client.send(new DeleteObjectCommand(deleteParams))
        .catch(err => console.error('Erro ao deletar arquivo órfão do S3:', err));
    }

    res.status(500).json({
      error: 'Erro ao processar upload',
      details: error.message
    });
  }
}

// GET /media - Listar todas as mídias do usuário autenticado
async function listUserMedia(req, res) {
  try {
    const { 
      type, 
      active, 
      search, 
      tag,           // Filtro por UUID de tag
      tags,          // Filtro por múltiplos UUIDs de tags (JSON array)
      limit = 20, 
      page = 1, 
      sortBy = 'created_at', 
      sortOrder = 'DESC' 
    } = req.query;

    // Validação de paginação
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    // Validação de ordenação
    const validSortFields = ['created_at', 'size', 'filename', 'title'];
    const validSortOrders = ['ASC', 'DESC'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';
    const sortDirection = validSortOrders.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

    // Construir filtro
    const where = { userId: req.user.id };

    if (type && ['image', 'video', 'audio'].includes(type)) {
      where.type = type;
    }

    if (active !== undefined) {
      where.active = active === 'true';
    } else {
      // Por padrão, mostrar apenas mídias ativas
      where.active = true;
    }

    // Filtro de busca por filename, title e description
    if (search) {
      where[Op.or] = [
        { filename: { [Op.iLike]: `%${search}%` } },
        { title: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } }
      ];
    }

    // Filtro por tags
    let tagFilter = [];
    if (tag) {
      tagFilter = [tag];
    } else if (tags) {
      try {
        tagFilter = JSON.parse(tags);
      } catch (e) {
        // Ignorar erro de parse
      }
    }

    let mediaIds = null;
    if (tagFilter.length > 0) {
      // Buscar tags do usuário
      const userTags = await Tag.findAll({
        where: {
          uuid: tagFilter,
          userId: req.user.id
        }
      });

      if (userTags.length > 0) {
        // Buscar mídias que têm TODAS as tags (interseção)
        const tagIds = userTags.map(t => t.id);
        
        // Para cada tag, buscar mídias associadas
        const mediaTagsPromises = tagIds.map(tagId => 
          MediaTag.findAll({ where: { tagId } })
        );
        
        const mediaTagsResults = await Promise.all(mediaTagsPromises);
        
        // Interseção: mídias que aparecem em TODAS as buscas
        const mediaSets = mediaTagsResults.map(
          results => new Set(results.map(mt => mt.mediaId))
        );
        
        let intersection = mediaSets[0] || new Set();
        for (let i = 1; i < mediaSets.length; i++) {
          intersection = new Set([...intersection].filter(x => mediaSets[i].has(x)));
        }
        
        mediaIds = [...intersection];
        
        if (mediaIds.length === 0) {
          // Nenhuma mídia com todas as tags
          return res.json({
            stats: { total: 0, filtered: 0, images: 0, videos: 0, audios: 0 },
            medias: [],
            pagination: {
              page: pageNum, limit: limitNum, offset: 0, total: 0, 
              pages: 0, hasNext: false, hasPrev: false
            }
          });
        }
        
        where.id = { [Op.in]: mediaIds };
      }
    }

    // Contar total ANTES de aplicar paginação
    const total = await Media.count({ where });

    // Buscar mídias com tags
    const medias = await Media.findAll({
      where,
      order: [[sortField, sortDirection]],
      attributes: { exclude: ['userId'] },
      limit: limitNum,
      offset: offset
    });

    // Buscar tags para cada mídia
    const mediasWithTags = await Promise.all(
      medias.map(async (media) => {
        const mediaTags = await MediaTag.findAll({
          where: { mediaId: media.id }
        });
        
        const tagIds = mediaTags.map(mt => mt.tagId);
        
        const tagsForMedia = tagIds.length > 0 
          ? await Tag.findAll({ where: { id: tagIds }, order: [['name', 'ASC']] })
          : [];
        
        return {
          ...media.toJSON(),
          tags: tagsForMedia.map(t => t.toJSON())
        };
      })
    );

    const totalPages = Math.ceil(total / limitNum);

    // Estatísticas
    const stats = {
      total: medias.length,
      filtered: total,
      images: await Media.countByType(req.user.id, 'image'),
      videos: await Media.countByType(req.user.id, 'video'),
      audios: await Media.countByType(req.user.id, 'audio')
    };

    res.json({
      stats,
      medias: mediasWithTags,
      pagination: {
        page: pageNum,
        limit: limitNum,
        offset: offset,
        total: total,
        pages: totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1
      }
    });

  } catch (error) {
    console.error('Erro ao listar mídias:', error);
    res.status(500).json({
      error: 'Erro ao listar mídias',
      details: error.message
    });
  }
}

// GET /media/:uuid - Buscar uma mídia específica
async function getMediaByUuid(req, res) {
  try {
    const { uuid } = req.params;

    const media = await Media.findByUuid(uuid);

    if (!media) {
      return res.status(404).json({ error: 'Mídia não encontrada' });
    }

    // Verificar se a mídia pertence ao usuário autenticado
    if (media.userId !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    // Buscar tags da mídia
    const mediaTags = await MediaTag.findAll({
      where: { mediaId: media.id }
    });
    
    const tagIds = mediaTags.map(mt => mt.tagId);
    
    const tags = tagIds.length > 0 
      ? await Tag.findAll({ where: { id: tagIds }, order: [['name', 'ASC']] })
      : [];

    res.json({
      media: {
        ...media.toJSON(),
        tags: tags.map(t => t.toJSON())
      }
    });

  } catch (error) {
    console.error('Erro ao buscar mídia:', error);
    res.status(500).json({
      error: 'Erro ao buscar mídia',
      details: error.message
    });
  }
}

// DELETE /media/:uuid - Deletar uma mídia específica (soft delete)
async function deleteMedia(req, res) {
  try {
    const { uuid } = req.params;
    const { permanent } = req.query; // ?permanent=true para hard delete

    const media = await Media.findByUuid(uuid);

    if (!media) {
      return res.status(404).json({ error: 'Mídia não encontrada' });
    }

    // Verificar propriedade
    if (media.userId !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    if (permanent === 'true') {
      // Hard delete: remover do S3 e do banco

      // Deletar do S3
      try {
        const deleteParams = {
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: media.s3_key
        };
        await s3Client.send(new DeleteObjectCommand(deleteParams));
        console.log(`Arquivo deletado do S3: ${media.s3_key}`);
      } catch (s3Error) {
        console.error('Erro ao deletar do S3:', s3Error);
        // Continuar mesmo se falhar no S3
      }

      // Deletar thumbnail do S3 (se existir)
      if (media.thumbnail_s3_key) {
        try {
          const deleteThumbnailParams = {
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: media.thumbnail_s3_key
          };
          await s3Client.send(new DeleteObjectCommand(deleteThumbnailParams));
          console.log(`✓ Thumbnail deletada do S3: ${media.thumbnail_s3_key}`);
        } catch (s3Error) {
          console.error('⚠ Erro ao deletar thumbnail do S3:', s3Error);
          // Continuar mesmo se falhar no S3
        }
      }

      // Deletar associações com tags
      await MediaTag.destroy({ where: { mediaId: media.id } });

      // Deletar do banco
      await media.destroy();

      res.json({
        message: 'Mídia deletada permanentemente',
        uuid: media.uuid
      });

    } else {
      // Soft delete: apenas marcar como inativo
      await media.softDelete();

      res.json({
        message: 'Mídia movida para a lixeira',
        uuid: media.uuid
      });
    }

  } catch (error) {
    console.error('Erro ao deletar mídia:', error);
    res.status(500).json({
      error: 'Erro ao deletar mídia',
      details: error.message
    });
  }
}

// PUT /media/:uuid - Atualizar title, description e tags
async function updateMedia(req, res) {
  try {
    const { uuid } = req.params;
    const { title, description, tagUuids } = req.body;

    const media = await Media.findByUuid(uuid);

    if (!media) {
      return res.status(404).json({ error: 'Mídia não encontrada' });
    }

    // Verificar propriedade
    if (media.userId !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const updates = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;

    // Atualizar campos básicos
    if (Object.keys(updates).length > 0) {
      await media.update(updates);
    }

    // Atualizar tags se fornecidas
    let updatedTags = [];
    if (tagUuids !== undefined) {
      // Remover todas as tags atuais
      await MediaTag.destroy({ where: { mediaId: media.id } });

      if (Array.isArray(tagUuids) && tagUuids.length > 0) {
        // Buscar tags válidas do usuário
        const tags = await Tag.findAll({
          where: {
            uuid: tagUuids,
            userId: req.user.id
          }
        });

        // Criar novas associações
        const associations = tags.map(tag => ({
          mediaId: media.id,
          tagId: tag.id
        }));

        if (associations.length > 0) {
          await MediaTag.bulkCreate(associations, { ignoreDuplicates: true });
          updatedTags = tags.map(t => t.toJSON());
        }
      }
    } else {
      // Buscar tags atuais se não foram fornecidas
      const mediaTags = await MediaTag.findAll({ where: { mediaId: media.id } });
      const tagIds = mediaTags.map(mt => mt.tagId);
      if (tagIds.length > 0) {
        const currentTags = await Tag.findAll({ where: { id: tagIds } });
        updatedTags = currentTags.map(t => t.toJSON());
      }
    }

    res.json({
      message: 'Mídia atualizada com sucesso',
      media: {
        ...media.toJSON(),
        tags: updatedTags
      }
    });

  } catch (error) {
    console.error('Erro ao atualizar mídia:', error);
    res.status(500).json({
      error: 'Erro ao atualizar mídia',
      details: error.message
    });
  }
}

// GET /media/:uuid/tags - Listar tags de uma mídia específica
async function getMediaTags(req, res) {
  try {
    const { uuid } = req.params;

    const media = await Media.findByUuid(uuid);
    if (!media) {
      return res.status(404).json({ error: 'Mídia não encontrada' });
    }

    // Verificar propriedade
    if (media.userId !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    // Buscar tags associadas
    const mediaTags = await MediaTag.findAll({
      where: { mediaId: media.id }
    });

    const tagIds = mediaTags.map(mt => mt.tagId);

    const tags = tagIds.length > 0
      ? await Tag.findAll({ where: { id: tagIds }, order: [['name', 'ASC']] })
      : [];

    res.json({
      mediaUuid: media.uuid,
      tags: tags.map(t => t.toJSON())
    });

  } catch (error) {
    console.error('Erro ao listar tags da mídia:', error);
    res.status(500).json({
      error: 'Erro ao listar tags',
      details: error.message
    });
  }
}

module.exports = {
  uploadMedia,
  listUserMedia,
  getMediaByUuid,
  deleteMedia,
  updateMedia,
  getMediaTags
};
