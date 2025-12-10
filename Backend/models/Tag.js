const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const Tag = sequelize.define('Tag', {
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
    comment: 'Identificador único da tag'
  },

  name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      len: {
        args: [1, 50],
        msg: 'Nome da tag deve ter entre 1 e 50 caracteres'
      },
      notEmpty: {
        msg: 'Nome da tag não pode estar vazio'
      }
    },
    comment: 'Nome da tag (ex: natureza, música, trabalho)'
  },

  color: {
    type: DataTypes.STRING(7),
    allowNull: true,
    defaultValue: '#6B7280',
    validate: {
      is: {
        args: /^#[0-9A-Fa-f]{6}$/,
        msg: 'Cor deve estar no formato hexadecimal (#RRGGBB)'
      }
    },
    comment: 'Cor da tag em hexadecimal para UI'
  },

  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    },
    onDelete: 'CASCADE',
    comment: 'ID do usuário proprietário da tag'
  },

  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: 'Data de criação'
  }
}, {
  tableName: 'tags',
  timestamps: false
});

// MÉTODOS ESTÁTICOS

// Buscar por UUID
Tag.findByUuid = async function(uuid) {
  return await this.findOne({ where: { uuid } });
};

// Buscar tags do usuário
Tag.findByUserId = async function(userId) {
  return await this.findAll({
    where: { userId },
    order: [['name', 'ASC']]
  });
};

// Buscar tag por nome do usuário
Tag.findByUserAndName = async function(userId, name) {
  return await this.findOne({
    where: { userId, name: name.toLowerCase().trim() }
  });
};

// HOOKS

// Normalizar nome da tag antes de criar/atualizar
Tag.beforeCreate((tag) => {
  tag.name = tag.name.toLowerCase().trim();
});

Tag.beforeUpdate((tag) => {
  if (tag.changed('name')) {
    tag.name = tag.name.toLowerCase().trim();
  }
});

// ASSOCIAÇÕES
Tag.associate = function(models) {
  Tag.belongsTo(models.User, {
    foreignKey: 'userId',
    as: 'user'
  });

  Tag.belongsToMany(models.Media, {
    through: 'MediaTags',
    foreignKey: 'tagId',
    otherKey: 'mediaId',
    as: 'medias'
  });
};

module.exports = Tag;
