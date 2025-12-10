const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const Media = sequelize.define('Media', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },

  uuid: {
    type: DataTypes.UUID,
    defaultValue: () => uuidv4(),
    allowNull: false,
    unique: true,
    comment: 'Identificador Ãºnico da mÃ­dia'
  },

  type: {
    type: DataTypes.ENUM('image', 'video', 'audio'),
    allowNull: false,
    comment: 'Tipo de mÃ­dia'
  },

  url: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'URL pÃºblica do S3'
  },

  s3_key: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Chave S3 para deleÃ§Ã£o (e.g., uploads/{uuid}/videos/{timestamp}_{filename})'
  },

  thumbnail_url: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'URL pÃºblica da thumbnail no S3 (150x150px WebP)'
  },

  thumbnail_s3_key: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Chave S3 da thumbnail para deleÃ§Ã£o'
  },

  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    },
    onDelete: 'CASCADE',
    comment: 'ID do usuÃ¡rio proprietÃ¡rio'
  },

  title: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      len: {
        args: [0, 255],
        msg: 'TÃ­tulo deve ter no mÃ¡ximo 255 caracteres'
      }
    },
    comment: 'TÃ­tulo opcional da mÃ­dia'
  },

  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    validate: {
      len: {
        args: [0, 1000],
        msg: 'DescriÃ§Ã£o deve ter no mÃ¡ximo 1000 caracteres'
      }
    },
    comment: 'DescriÃ§Ã£o opcional da mÃ­dia'
  },

  filename: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Nome original do arquivo'
  },

  size: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'Tamanho do arquivo em bytes'
  },

  mimetype: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Tipo MIME do arquivo'
  },

  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: null,
    comment: 'Metadados extraidos do arquivo - dimensoes EXIF duracao etc'
  },

  active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    comment: 'Soft delete: false = na lixeira'
  },

  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: 'Data de criaÃ§Ã£o'
  },

  updated_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: 'Data de Ãºltima atualizaÃ§Ã£o'
  }
}, {
  tableName: 'media',
  timestamps: false,
  indexes: [
    {
      unique: true,
      fields: ['uuid'],
      name: 'media_uuid_unique'
    },
    {
      fields: ['userId'],
      name: 'media_userId_index'
    },
    {
      fields: ['userId', 'active'],
      name: 'media_userId_active_index'
    },
    {
      fields: ['type'],
      name: 'media_type_index'
    }
  ]
});

// HOOKS

// Atualizar updated_at antes de cada update
Media.beforeUpdate((media) => {
  media.updated_at = new Date();
});

// MÃ‰TODOS ESTÃTICOS

// Buscar por UUID
Media.findByUuid = async function(uuid) {
  return await this.findOne({ where: { uuid } });
};

// Buscar mÃ­dias ativas do usuÃ¡rio
Media.findActiveByUserId = async function(userId, type = null) {
  const where = { userId, active: true };
  if (type) where.type = type;

  return await this.findAll({
    where,
    order: [['created_at', 'DESC']]
  });
};

// Contar mÃ­dias por tipo
Media.countByType = async function(userId, type) {
  return await this.count({
    where: { userId, type, active: true }
  });
};

// MÃ‰TODOS DE INSTÃ‚NCIA

// Soft delete
Media.prototype.softDelete = async function() {
  return await this.update({ active: false });
};

// Restaurar da lixeira
Media.prototype.restore = async function() {
  return await this.update({ active: true });
};

// ASSOCIAÃ‡Ã•ES
Media.associate = function(models) {
  Media.belongsTo(models.User, {
    foreignKey: 'userId',
    as: 'user'
  });

  // AssociaÃ§Ã£o com Tags (N:N)
  Media.belongsToMany(models.Tag, {
    through: 'MediaTags',
    foreignKey: 'mediaId',
    otherKey: 'tagId',
    as: 'tags'
  });
};

module.exports = Media;
