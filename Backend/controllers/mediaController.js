const Media = require('../models/Media');
const User = require('../models/User');
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
    const { title, description } = req.body;

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

    res.status(201).json({
      message: 'Mídia enviada com sucesso!',
      media: media.toJSON()
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
    const { type, active, search, limit = 20, page = 1, sortBy = 'created_at', sortOrder = 'DESC' } = req.query;

    // Validação de paginação
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    // Validação de ordenação
    const validSortFields = ['created_at', 'size', 'filename'];
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

    // Filtro de busca por filename
    if (search) {
      where.filename = { [Op.like]: `%${search}%` };
    }

    // Contar total ANTES de aplicar paginação
    const total = await Media.count({ where });

    const medias = await Media.findAll({
      where,
      order: [[sortField, sortDirection]],
      attributes: { exclude: ['userId'] }, // Não retornar userId no JSON
      limit: limitNum,
      offset: offset
    });

    const totalPages = Math.ceil(total / limitNum);

    // Estatísticas
    const stats = {
      total: medias.length,  // Itens na página atual
      filtered: total,       // Total matching filters
      images: await Media.countByType(req.user.id, 'image'),
      videos: await Media.countByType(req.user.id, 'video'),
      audios: await Media.countByType(req.user.id, 'audio')
    };

    res.json({
      stats,
      medias,
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

    res.json({
      media: media.toJSON()
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

// PUT /media/:uuid - Atualizar title e description
async function updateMedia(req, res) {
  try {
    const { uuid } = req.params;
    const { title, description } = req.body;

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

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Nenhuma alteração fornecida' });
    }

    await media.update(updates);

    res.json({
      message: 'Mídia atualizada com sucesso',
      media: media.toJSON()
    });

  } catch (error) {
    console.error('Erro ao atualizar mídia:', error);
    res.status(500).json({
      error: 'Erro ao atualizar mídia',
      details: error.message
    });
  }
}

module.exports = {
  uploadMedia,
  listUserMedia,
  getMediaByUuid,
  deleteMedia,
  updateMedia
};
