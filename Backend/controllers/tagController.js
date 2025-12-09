const Tag = require('../models/Tag');
const Media = require('../models/Media');
const MediaTag = require('../models/MediaTag');
const { Op } = require('sequelize');

// Cores predefinidas para sugestão
const PRESET_COLORS = [
  '#EF4444', // vermelho
  '#F97316', // laranja
  '#EAB308', // amarelo
  '#22C55E', // verde
  '#14B8A6', // teal
  '#3B82F6', // azul
  '#8B5CF6', // violeta
  '#EC4899', // rosa
  '#6B7280', // cinza
  '#78716C'  // marrom
];

// GET /tags - Listar todas as tags do usuário
async function listUserTags(req, res) {
  try {
    const tags = await Tag.findByUserId(req.user.id);

    // Contar mídias por tag
    const tagsWithCount = await Promise.all(
      tags.map(async (tag) => {
        const count = await MediaTag.count({ where: { tagId: tag.id } });
        return {
          ...tag.toJSON(),
          mediaCount: count
        };
      })
    );

    res.json({
      tags: tagsWithCount,
      total: tagsWithCount.length,
      presetColors: PRESET_COLORS
    });

  } catch (error) {
    console.error('Erro ao listar tags:', error);
    res.status(500).json({
      error: 'Erro ao listar tags',
      details: error.message
    });
  }
}

// POST /tags - Criar nova tag
async function createTag(req, res) {
  try {
    const { name, color } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Nome da tag é obrigatório' });
    }

    const normalizedName = name.toLowerCase().trim();

    // Verificar se tag já existe para o usuário
    const existingTag = await Tag.findByUserAndName(req.user.id, normalizedName);
    if (existingTag) {
      return res.status(400).json({ error: 'Você já possui uma tag com esse nome' });
    }

    // Criar tag
    const tag = await Tag.create({
      name: normalizedName,
      color: color || PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)],
      userId: req.user.id
    });

    res.status(201).json({
      message: 'Tag criada com sucesso!',
      tag: {
        ...tag.toJSON(),
        mediaCount: 0
      }
    });

  } catch (error) {
    console.error('Erro ao criar tag:', error);
    res.status(500).json({
      error: 'Erro ao criar tag',
      details: error.message
    });
  }
}

// PUT /tags/:uuid - Atualizar tag
async function updateTag(req, res) {
  try {
    const { uuid } = req.params;
    const { name, color } = req.body;

    const tag = await Tag.findByUuid(uuid);

    if (!tag) {
      return res.status(404).json({ error: 'Tag não encontrada' });
    }

    // Verificar propriedade
    if (tag.userId !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const updates = {};

    // Validar e atualizar nome
    if (name !== undefined) {
      const normalizedName = name.toLowerCase().trim();
      
      if (!normalizedName) {
        return res.status(400).json({ error: 'Nome da tag não pode estar vazio' });
      }

      // Verificar duplicidade (excluindo a própria tag)
      const existingTag = await Tag.findOne({
        where: {
          userId: req.user.id,
          name: normalizedName,
          id: { [Op.ne]: tag.id }
        }
      });

      if (existingTag) {
        return res.status(400).json({ error: 'Você já possui uma tag com esse nome' });
      }

      updates.name = normalizedName;
    }

    // Atualizar cor
    if (color !== undefined) {
      updates.color = color;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Nenhuma alteração fornecida' });
    }

    await tag.update(updates);

    // Contar mídias
    const mediaCount = await MediaTag.count({ where: { tagId: tag.id } });

    res.json({
      message: 'Tag atualizada com sucesso!',
      tag: {
        ...tag.toJSON(),
        mediaCount
      }
    });

  } catch (error) {
    console.error('Erro ao atualizar tag:', error);
    res.status(500).json({
      error: 'Erro ao atualizar tag',
      details: error.message
    });
  }
}

// DELETE /tags/:uuid - Deletar tag
async function deleteTag(req, res) {
  try {
    const { uuid } = req.params;

    const tag = await Tag.findByUuid(uuid);

    if (!tag) {
      return res.status(404).json({ error: 'Tag não encontrada' });
    }

    // Verificar propriedade
    if (tag.userId !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    // Deletar tag (cascade remove associações)
    await tag.destroy();

    res.json({
      message: 'Tag deletada com sucesso!',
      uuid: tag.uuid
    });

  } catch (error) {
    console.error('Erro ao deletar tag:', error);
    res.status(500).json({
      error: 'Erro ao deletar tag',
      details: error.message
    });
  }
}

// POST /tags/:uuid/media/:mediaUuid - Adicionar tag a uma mídia
async function addTagToMedia(req, res) {
  try {
    const { uuid, mediaUuid } = req.params;

    // Buscar tag
    const tag = await Tag.findByUuid(uuid);
    if (!tag) {
      return res.status(404).json({ error: 'Tag não encontrada' });
    }

    // Verificar propriedade da tag
    if (tag.userId !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado à tag' });
    }

    // Buscar mídia
    const media = await Media.findByUuid(mediaUuid);
    if (!media) {
      return res.status(404).json({ error: 'Mídia não encontrada' });
    }

    // Verificar propriedade da mídia
    if (media.userId !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado à mídia' });
    }

    // Adicionar associação
    const [association, created] = await MediaTag.addTagToMedia(media.id, tag.id);

    if (!created) {
      return res.status(400).json({ error: 'Esta tag já está associada a esta mídia' });
    }

    res.status(201).json({
      message: 'Tag adicionada à mídia com sucesso!',
      tag: tag.toJSON(),
      mediaUuid: media.uuid
    });

  } catch (error) {
    console.error('Erro ao adicionar tag à mídia:', error);
    res.status(500).json({
      error: 'Erro ao adicionar tag',
      details: error.message
    });
  }
}

// DELETE /tags/:uuid/media/:mediaUuid - Remover tag de uma mídia
async function removeTagFromMedia(req, res) {
  try {
    const { uuid, mediaUuid } = req.params;

    // Buscar tag
    const tag = await Tag.findByUuid(uuid);
    if (!tag) {
      return res.status(404).json({ error: 'Tag não encontrada' });
    }

    // Verificar propriedade da tag
    if (tag.userId !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado à tag' });
    }

    // Buscar mídia
    const media = await Media.findByUuid(mediaUuid);
    if (!media) {
      return res.status(404).json({ error: 'Mídia não encontrada' });
    }

    // Verificar propriedade da mídia
    if (media.userId !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado à mídia' });
    }

    // Remover associação
    const deleted = await MediaTag.removeTagFromMedia(media.id, tag.id);

    if (!deleted) {
      return res.status(404).json({ error: 'Esta tag não está associada a esta mídia' });
    }

    res.json({
      message: 'Tag removida da mídia com sucesso!',
      tagUuid: tag.uuid,
      mediaUuid: media.uuid
    });

  } catch (error) {
    console.error('Erro ao remover tag da mídia:', error);
    res.status(500).json({
      error: 'Erro ao remover tag',
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

    const tags = await Tag.findAll({
      where: { id: tagIds },
      order: [['name', 'ASC']]
    });

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

// PUT /media/:uuid/tags - Atualizar todas as tags de uma mídia (bulk)
async function updateMediaTags(req, res) {
  try {
    const { uuid } = req.params;
    const { tagUuids } = req.body; // Array de UUIDs de tags

    if (!Array.isArray(tagUuids)) {
      return res.status(400).json({ error: 'tagUuids deve ser um array' });
    }

    const media = await Media.findByUuid(uuid);
    if (!media) {
      return res.status(404).json({ error: 'Mídia não encontrada' });
    }

    // Verificar propriedade
    if (media.userId !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    // Buscar tags pelos UUIDs
    const tags = await Tag.findAll({
      where: {
        uuid: tagUuids,
        userId: req.user.id // Garantir que são tags do usuário
      }
    });

    // Remover todas as associações atuais
    await MediaTag.destroy({
      where: { mediaId: media.id }
    });

    // Criar novas associações
    const associations = tags.map(tag => ({
      mediaId: media.id,
      tagId: tag.id
    }));

    if (associations.length > 0) {
      await MediaTag.bulkCreate(associations, { ignoreDuplicates: true });
    }

    res.json({
      message: 'Tags atualizadas com sucesso!',
      mediaUuid: media.uuid,
      tags: tags.map(t => t.toJSON())
    });

  } catch (error) {
    console.error('Erro ao atualizar tags da mídia:', error);
    res.status(500).json({
      error: 'Erro ao atualizar tags',
      details: error.message
    });
  }
}

module.exports = {
  listUserTags,
  createTag,
  updateTag,
  deleteTag,
  addTagToMedia,
  removeTagFromMedia,
  getMediaTags,
  updateMediaTags,
  PRESET_COLORS
};
