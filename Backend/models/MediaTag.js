const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const MediaTag = sequelize.define('MediaTag', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },

  mediaId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'media',
      key: 'id'
    },
    onDelete: 'CASCADE',
    comment: 'ID da mídia'
  },

  tagId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'tags',
      key: 'id'
    },
    onDelete: 'CASCADE',
    comment: 'ID da tag'
  },

  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: 'Data de associação'
  }
}, {
  tableName: 'media_tags',
  timestamps: false,
  indexes: [
    {
      unique: true,
      fields: ['mediaId', 'tagId'],
      name: 'media_tags_unique'
    },
    {
      fields: ['mediaId'],
      name: 'media_tags_mediaId_index'
    },
    {
      fields: ['tagId'],
      name: 'media_tags_tagId_index'
    }
  ]
});

// MÉTODOS ESTÁTICOS

// Adicionar tag a uma mídia
MediaTag.addTagToMedia = async function(mediaId, tagId) {
  return await this.findOrCreate({
    where: { mediaId, tagId },
    defaults: { mediaId, tagId }
  });
};

// Remover tag de uma mídia
MediaTag.removeTagFromMedia = async function(mediaId, tagId) {
  return await this.destroy({
    where: { mediaId, tagId }
  });
};

// Buscar todas as tags de uma mídia
MediaTag.getTagsForMedia = async function(mediaId) {
  return await this.findAll({
    where: { mediaId }
  });
};

// Buscar todas as mídias com uma tag
MediaTag.getMediasForTag = async function(tagId) {
  return await this.findAll({
    where: { tagId }
  });
};

module.exports = MediaTag;
