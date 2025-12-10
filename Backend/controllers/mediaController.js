const Media = require('../models/Media');
const User = require('../models/User');
const Tag = require('../models/Tag');
const MediaTag = require('../models/MediaTag');
const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
const s3Client = require('../config/s3');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { generateThumbnail } = require('../utils/thumbnailGenerator');
const { extractMetadata } = require('../utils/metadataExtractor');
const { processVideoQualitiesAsync } = require('../utils/videoTranscoder');

// Helper para criar busca case-insensitive compativel com SQLite e PostgreSQL
function createCaseInsensitiveSearch(field, value) {
  const dialect = sequelize.getDialect();
  
  if (dialect === 'postgres') {
    // PostgreSQL suporta ILIKE nativamente
    return { [field]: { [Op.iLike]: `%${value}%` } };
  } else {
    // SQLite usa LIKE que ja e case-insensitive por padrao para ASCII
    // Mas para garantir usamos LOWER()
    return sequelize.where(
      sequelize.fn('LOWER', sequelize.col(field)),
      { [Op.like]: `%${value.toLowerCase()}%` }
    );
  }
}

// POST /media/upload - Upload de nova midia
async function uploadMedia(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo foi enviado' });
    }

    const usuario = await User.findByPk(req.user.id);

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario nao encontrado' });
    }

    // Dados do arquivo fornecidos pelo multer-s3 e middleware
    const { title, description, tagUuids } = req.body;

    // Gerar thumbnail
    let thumbnailData = { thumbnail_url: null, thumbnail_s3_key: null };

    try {
      console.log(`Gerando thumbnail para ${req.mediaType}...`);

      thumbnailData = await generateThumbnail({
        mediaType: req.mediaType,
        fileUrl: req.file.location,
        userUuid: usuario.uuid,
        filename: req.originalFilename,
        metadata: {
          mimetype: req.file.mimetype,
          size: req.file.size
        }
      });

      if (thumbnailData.thumbnail_url) {
        console.log(`Thumbnail gerada: ${thumbnailData.thumbnail_url}`);
      }
    } catch (thumbnailError) {
      console.error('Erro ao gerar thumbnail nao critico:', thumbnailError.message);
    }

    // Extrair metadados do arquivo
    let mediaMetadata = null;
    try {
      console.log(`Extraindo metadados para ${req.mediaType}...`);
      mediaMetadata = await extractMetadata(req.mediaType, req.file.location);
      
      if (mediaMetadata) {
        console.log(`Metadados extraidos com sucesso`);
      }
    } catch (metadataError) {
      console.error('Erro ao extrair metadados nao critico:', metadataError.message);
    }

    // Determinar status de processamento para videos
    let processingStatus = null;
    if (req.mediaType === 'video') {
      processingStatus = 'pending';
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
      mimetype: req.file.mimetype,
      metadata: mediaMetadata,
      processing_status: processingStatus,
      video_versions: null
    });

    // Processar tags se fornecidas
    let associatedTags = [];
    if (tagUuids) {
      try {
        const tagIds = JSON.parse(tagUuids);
        if (Array.isArray(tagIds) && tagIds.length > 0) {
          const tags = await Tag.findAll({
            where: {
              uuid: tagIds,
              userId: usuario.id
            }
          });

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
      }
    }

    // Se for video iniciar processamento de qualidades em background
    if (req.mediaType === 'video') {
      console.log('Iniciando processamento de video em background...');
      
      // Atualizar status para processing
      await media.update({ processing_status: 'processing' });
      
      // Processar em background sem bloquear a resposta
      processVideoQualitiesAsync({
        videoUrl: req.file.location,
        userUuid: usuario.uuid,
        filename: req.originalFilename,
        mediaId: media.id
      }, async (result) => {
        // Callback para atualizar o banco quando processamento terminar
        try {
          if (result.success && result.versions.length > 0) {
            await media.update({
              video_versions: result.versions,
              processing_status: 'completed'
            });
            console.log(`Video ${media.uuid} processado com sucesso: ${result.versions.length} versoes`);
          } else {
            await media.update({
              processing_status: 'failed',
              video_versions: []
            });
            console.error(`Falha no processamento do video ${media.uuid}: ${result.error}`);
          }
        } catch (updateError) {
          console.error('Erro ao atualizar status do video:', updateError);
        }
      }).catch(err => {
        console.error('Erro no processamento assincrono:', err);
        media.update({ processing_status: 'failed' }).catch(() => {});
      });
    }

    res.status(201).json({
      message: 'Midia enviada com sucesso!',
      media: {
        ...media.toJSON(),
        tags: associatedTags,
        availableQualities: media.getAvailableQualities()
      }
    });

  } catch (error) {
    console.error('Erro ao fazer upload de midia:', error);

    if (req.file && req.file.key) {
      const deleteParams = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: req.file.key
      };
      s3Client.send(new DeleteObjectCommand(deleteParams))
        .catch(err => console.error('Erro ao deletar arquivo orfao do S3:', err));
    }

    res.status(500).json({
      error: 'Erro ao processar upload',
      details: error.message
    });
  }
}

// GET /media - Listar todas as midias do usuario autenticado
async function listUserMedia(req, res) {
  try {
    const { 
      type, 
      active, 
      search, 
      tag,
      tags,
      limit = 20, 
      page = 1, 
      sortBy = 'created_at', 
      sortOrder = 'DESC' 
    } = req.query;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    const validSortFields = ['created_at', 'size', 'filename', 'title'];
    const validSortOrders = ['ASC', 'DESC'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';
    const sortDirection = validSortOrders.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

    const where = { userId: req.user.id };

    if (type && ['image', 'video', 'audio'].includes(type)) {
      where.type = type;
    }

    if (active !== undefined) {
      where.active = active === 'true';
    } else {
      where.active = true;
    }

    if (search) {
      where[Op.or] = [
        createCaseInsensitiveSearch('filename', search),
        createCaseInsensitiveSearch('title', search),
        createCaseInsensitiveSearch('description', search)
      ];
    }

    let tagFilter = [];
    if (tag) {
      tagFilter = [tag];
    } else if (tags) {
      try {
        tagFilter = JSON.parse(tags);
      } catch (e) {}
    }

    let mediaIds = null;
    if (tagFilter.length > 0) {
      const userTags = await Tag.findAll({
        where: {
          uuid: tagFilter,
          userId: req.user.id
        }
      });

      if (userTags.length > 0) {
        const tagIds = userTags.map(t => t.id);
        
        const mediaTagsPromises = tagIds.map(tagId => 
          MediaTag.findAll({ where: { tagId } })
        );
        
        const mediaTagsResults = await Promise.all(mediaTagsPromises);
        
        const mediaSets = mediaTagsResults.map(
          results => new Set(results.map(mt => mt.mediaId))
        );
        
        let intersection = mediaSets[0] || new Set();
        for (let i = 1; i < mediaSets.length; i++) {
          intersection = new Set([...intersection].filter(x => mediaSets[i].has(x)));
        }
        
        mediaIds = [...intersection];
        
        if (mediaIds.length === 0) {
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

    const total = await Media.count({ where });

    const medias = await Media.findAll({
      where,
      order: [[sortField, sortDirection]],
      attributes: { exclude: ['userId'] },
      limit: limitNum,
      offset: offset
    });

    const mediasWithTags = await Promise.all(
      medias.map(async (media) => {
        const mediaTags = await MediaTag.findAll({
          where: { mediaId: media.id }
        });
        
        const tagIds = mediaTags.map(mt => mt.tagId);
        
        const tagsForMedia = tagIds.length > 0 
          ? await Tag.findAll({ where: { id: tagIds }, order: [['name', 'ASC']] })
          : [];
        
        const mediaJson = media.toJSON();
        
        return {
          ...mediaJson,
          tags: tagsForMedia.map(t => t.toJSON()),
          availableQualities: media.getAvailableQualities()
        };
      })
    );

    const totalPages = Math.ceil(total / limitNum);

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
    console.error('Erro ao listar midias:', error);
    res.status(500).json({
      error: 'Erro ao listar midias',
      details: error.message
    });
  }
}

// GET /media/:uuid - Buscar uma midia especifica
async function getMediaByUuid(req, res) {
  try {
    const { uuid } = req.params;
    const { quality } = req.query;

    const media = await Media.findByUuid(uuid);

    if (!media) {
      return res.status(404).json({ error: 'Midia nao encontrada' });
    }

    if (media.userId !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const mediaTags = await MediaTag.findAll({
      where: { mediaId: media.id }
    });
    
    const tagIds = mediaTags.map(mt => mt.tagId);
    
    const tags = tagIds.length > 0 
      ? await Tag.findAll({ where: { id: tagIds }, order: [['name', 'ASC']] })
      : [];

    const mediaJson = media.toJSON();

    // Adicionar informacoes de qualidade para videos
    const response = {
      ...mediaJson,
      tags: tags.map(t => t.toJSON()),
      availableQualities: media.getAvailableQualities()
    };

    // Se solicitou qualidade especifica adicionar URL da qualidade
    if (quality && media.type === 'video') {
      response.requestedQualityUrl = media.getVideoUrl(quality);
    }

    res.json({ media: response });

  } catch (error) {
    console.error('Erro ao buscar midia:', error);
    res.status(500).json({
      error: 'Erro ao buscar midia',
      details: error.message
    });
  }
}

// GET /media/:uuid/stream - Obter URL de streaming para qualidade especifica
async function getStreamUrl(req, res) {
  try {
    const { uuid } = req.params;
    const { quality = '1080p' } = req.query;

    const media = await Media.findByUuid(uuid);

    if (!media) {
      return res.status(404).json({ error: 'Midia nao encontrada' });
    }

    if (media.userId !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    if (media.type !== 'video') {
      return res.status(400).json({ error: 'Esta midia nao e um video' });
    }

    const streamUrl = media.getVideoUrl(quality);
    const availableQualities = media.getAvailableQualities();

    res.json({
      uuid: media.uuid,
      quality: quality,
      url: streamUrl,
      availableQualities: availableQualities,
      processingStatus: media.processing_status
    });

  } catch (error) {
    console.error('Erro ao obter URL de streaming:', error);
    res.status(500).json({
      error: 'Erro ao obter URL de streaming',
      details: error.message
    });
  }
}

// DELETE /media/:uuid - Deletar uma midia especifica
async function deleteMedia(req, res) {
  try {
    const { uuid } = req.params;
    const { permanent } = req.query;

    const media = await Media.findByUuid(uuid);

    if (!media) {
      return res.status(404).json({ error: 'Midia nao encontrada' });
    }

    if (media.userId !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    if (permanent === 'true') {
      // Hard delete remover do S3 e do banco

      // Deletar arquivo original do S3
      try {
        const deleteParams = {
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: media.s3_key
        };
        await s3Client.send(new DeleteObjectCommand(deleteParams));
        console.log(`Arquivo deletado do S3: ${media.s3_key}`);
      } catch (s3Error) {
        console.error('Erro ao deletar do S3:', s3Error);
      }

      // Deletar thumbnail do S3
      if (media.thumbnail_s3_key) {
        try {
          const deleteThumbnailParams = {
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: media.thumbnail_s3_key
          };
          await s3Client.send(new DeleteObjectCommand(deleteThumbnailParams));
          console.log(`Thumbnail deletada do S3: ${media.thumbnail_s3_key}`);
        } catch (s3Error) {
          console.error('Erro ao deletar thumbnail do S3:', s3Error);
        }
      }

      // Deletar versoes de video transcodificadas do S3
      if (media.video_versions && Array.isArray(media.video_versions)) {
        for (const version of media.video_versions) {
          if (version.s3_key) {
            try {
              const deleteVersionParams = {
                Bucket: process.env.AWS_BUCKET_NAME,
                Key: version.s3_key
              };
              await s3Client.send(new DeleteObjectCommand(deleteVersionParams));
              console.log(`Versao ${version.quality} deletada do S3: ${version.s3_key}`);
            } catch (s3Error) {
              console.error(`Erro ao deletar versao ${version.quality} do S3:`, s3Error);
            }
          }
        }
      }

      // Deletar associacoes com tags
      await MediaTag.destroy({ where: { mediaId: media.id } });

      // Deletar do banco
      await media.destroy();

      res.json({
        message: 'Midia deletada permanentemente',
        uuid: media.uuid
      });

    } else {
      await media.softDelete();

      res.json({
        message: 'Midia movida para a lixeira',
        uuid: media.uuid
      });
    }

  } catch (error) {
    console.error('Erro ao deletar midia:', error);
    res.status(500).json({
      error: 'Erro ao deletar midia',
      details: error.message
    });
  }
}

// PUT /media/:uuid - Atualizar title description e tags
async function updateMedia(req, res) {
  try {
    const { uuid } = req.params;
    const { title, description, tagUuids } = req.body;

    const media = await Media.findByUuid(uuid);

    if (!media) {
      return res.status(404).json({ error: 'Midia nao encontrada' });
    }

    if (media.userId !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const updates = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;

    if (Object.keys(updates).length > 0) {
      await media.update(updates);
    }

    let updatedTags = [];
    if (tagUuids !== undefined) {
      await MediaTag.destroy({ where: { mediaId: media.id } });

      if (Array.isArray(tagUuids) && tagUuids.length > 0) {
        const tags = await Tag.findAll({
          where: {
            uuid: tagUuids,
            userId: req.user.id
          }
        });

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
      const mediaTags = await MediaTag.findAll({ where: { mediaId: media.id } });
      const tagIds = mediaTags.map(mt => mt.tagId);
      if (tagIds.length > 0) {
        const currentTags = await Tag.findAll({ where: { id: tagIds } });
        updatedTags = currentTags.map(t => t.toJSON());
      }
    }

    res.json({
      message: 'Midia atualizada com sucesso',
      media: {
        ...media.toJSON(),
        tags: updatedTags,
        availableQualities: media.getAvailableQualities()
      }
    });

  } catch (error) {
    console.error('Erro ao atualizar midia:', error);
    res.status(500).json({
      error: 'Erro ao atualizar midia',
      details: error.message
    });
  }
}

// GET /media/:uuid/tags - Listar tags de uma midia especifica
async function getMediaTags(req, res) {
  try {
    const { uuid } = req.params;

    const media = await Media.findByUuid(uuid);
    if (!media) {
      return res.status(404).json({ error: 'Midia nao encontrada' });
    }

    if (media.userId !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

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
    console.error('Erro ao listar tags da midia:', error);
    res.status(500).json({
      error: 'Erro ao listar tags',
      details: error.message
    });
  }
}

// POST /media/:uuid/reprocess - Reprocessar video forcar nova transcodificacao
async function reprocessVideo(req, res) {
  try {
    const { uuid } = req.params;

    const media = await Media.findByUuid(uuid);

    if (!media) {
      return res.status(404).json({ error: 'Midia nao encontrada' });
    }

    if (media.userId !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    if (media.type !== 'video') {
      return res.status(400).json({ error: 'Esta midia nao e um video' });
    }

    // Verificar se ja esta processando
    if (media.processing_status === 'processing') {
      return res.status(400).json({ error: 'Video ja esta sendo processado' });
    }

    const usuario = await User.findByPk(req.user.id);

    // Atualizar status para processing
    await media.update({ processing_status: 'processing' });

    // Processar em background
    processVideoQualitiesAsync({
      videoUrl: media.url,
      userUuid: usuario.uuid,
      filename: media.filename,
      mediaId: media.id
    }, async (result) => {
      try {
        if (result.success && result.versions.length > 0) {
          await media.update({
            video_versions: result.versions,
            processing_status: 'completed'
          });
          console.log(`Video ${media.uuid} reprocessado com sucesso`);
        } else {
          await media.update({ processing_status: 'failed' });
          console.error(`Falha no reprocessamento do video ${media.uuid}`);
        }
      } catch (updateError) {
        console.error('Erro ao atualizar status:', updateError);
      }
    }).catch(err => {
      console.error('Erro no reprocessamento:', err);
      media.update({ processing_status: 'failed' }).catch(() => {});
    });

    res.json({
      message: 'Reprocessamento iniciado',
      uuid: media.uuid,
      status: 'processing'
    });

  } catch (error) {
    console.error('Erro ao reprocessar video:', error);
    res.status(500).json({
      error: 'Erro ao reprocessar video',
      details: error.message
    });
  }
}

// GET /media/:uuid/processing-status - Verificar status do processamento
async function getProcessingStatus(req, res) {
  try {
    const { uuid } = req.params;

    const media = await Media.findByUuid(uuid);

    if (!media) {
      return res.status(404).json({ error: 'Midia nao encontrada' });
    }

    if (media.userId !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    res.json({
      uuid: media.uuid,
      type: media.type,
      processingStatus: media.processing_status,
      availableQualities: media.getAvailableQualities(),
      videoVersions: media.video_versions
    });

  } catch (error) {
    console.error('Erro ao obter status de processamento:', error);
    res.status(500).json({
      error: 'Erro ao obter status',
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
  getMediaTags,
  getStreamUrl,
  reprocessVideo,
  getProcessingStatus
};