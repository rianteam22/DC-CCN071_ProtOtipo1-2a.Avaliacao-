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
    comment: 'Identificador único da mídia'
  },

  type: {
    type: DataTypes.ENUM('image', 'video', 'audio'),
    allowNull: false,
    comment: 'Tipo de mídia'
  },

  url: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'URL pública do S3'
  },

  s3_key: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Chave S3 para deleção (e.g., uploads/{uuid}/videos/{timestamp}_{filename})'
  },

  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    },
    onDelete: 'CASCADE',
    comment: 'ID do usuário proprietário'
  },

  title: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      len: {
        args: [0, 255],
        msg: 'Título deve ter no máximo 255 caracteres'
      }
    },
    comment: 'Título opcional da mídia'
  },

  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    validate: {
      len: {
        args: [0, 1000],
        msg: 'Descrição deve ter no máximo 1000 caracteres'
      }
    },
    comment: 'Descrição opcional da mídia'
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
    comment: 'Data de criação'
  },

  updated_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: 'Data de última atualização'
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

// MÉTODOS ESTÁTICOS

// Buscar por UUID
Media.findByUuid = async function(uuid) {
  return await this.findOne({ where: { uuid } });
};

// Buscar mídias ativas do usuário
Media.findActiveByUserId = async function(userId, type = null) {
  const where = { userId, active: true };
  if (type) where.type = type;

  return await this.findAll({
    where,
    order: [['created_at', 'DESC']]
  });
};

// Contar mídias por tipo
Media.countByType = async function(userId, type) {
  return await this.count({
    where: { userId, type, active: true }
  });
};

// MÉTODOS DE INSTÂNCIA

// Soft delete
Media.prototype.softDelete = async function() {
  return await this.update({ active: false });
};

// Restaurar da lixeira
Media.prototype.restore = async function() {
  return await this.update({ active: true });
};

// ASSOCIAÇÕES
Media.associate = function(models) {
  Media.belongsTo(models.User, {
    foreignKey: 'userId',
    as: 'user'
  });
};

module.exports = Media;
