const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');

const User = sequelize.define('User', {
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
    comment: 'Identificador único universal - gerado automaticamente na criação'
  },
  
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: {
        msg: 'Email inválido'
      },
      notEmpty: {
        msg: 'Email não pode estar vazio'
      }
    },
    comment: 'Email do usuário - obrigatório e único'
  },
  
  senha: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Senha não pode estar vazia'
      },
      len: {
        args: [6, 100],
        msg: 'Senha deve ter no mínimo 6 caracteres'
      }
    },
    comment: 'Senha hash do usuário - obrigatório'
  },
  
  user: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
    validate: {
      len: {
        args: [3, 30],
        msg: 'Username deve ter entre 3 e 30 caracteres'
      }
    },
    comment: 'Nome de usuário único - opcional'
  },
  
  name: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Nome completo do usuário - opcional'
  },
  
  profile_pic: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: null,
    comment: 'URL da foto de perfil no S3'
  },
  
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: null,
    validate: {
      len: {
        args: [0, 500],
        msg: 'Descrição deve ter no máximo 500 caracteres'
      }
    },
    comment: 'Biografia/descrição do usuário - opcional'
  },
  
  timestamp_created: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: 'Data e hora de criação da conta'
  }
}, {
  tableName: 'users',
  timestamps: false, 
  indexes: [
    {
      unique: true,
      fields: ['email'],
      name: 'users_email_unique'
    },
    {
      unique: true,
      fields: ['user'],
      name: 'users_username_unique',
      where: {
        user: { [sequelize.Sequelize.Op.ne]: null }
      }
    },
    {
      unique: true,
      fields: ['uuid'],
      name: 'users_uuid_unique'
    }
  ]
});

// HOOKS 

// Hash de senha antes de criar
User.beforeCreate(async (user) => {
  if (user.senha) {
    const salt = await bcrypt.genSalt(10);
    user.senha = await bcrypt.hash(user.senha, salt);
  }
});

// Hash de senha antes de atualizar
User.beforeUpdate(async (user) => {
  if (user.changed('senha')) {
    const salt = await bcrypt.genSalt(10);
    user.senha = await bcrypt.hash(user.senha, salt);
  }
});

// MÉTODOS DE INSTÂNCIA

// Validar senha no login
User.prototype.validPassword = async function(senha) {
  return await bcrypt.compare(senha, this.senha);
};

// Obter URL da foto de perfil
User.prototype.getProfilePicPath = function() {
  return this.profile_pic || null;
};

// Verificar se perfil está completo
User.prototype.isProfileComplete = function() {
  return !!(this.user && this.name && this.profile_pic);
};

// JSON sem campo senha
User.prototype.toJSON = function() {
  const values = { ...this.get() };
  delete values.senha; 
  return values;
};

// MÉTODOS ESTÁTICOS

// Buscar por email
User.findByEmail = async function(email) {
  return await this.findOne({ where: { email } });
};

// Buscar por username
User.findByUsername = async function(username) {
  return await this.findOne({ where: { user: username } });
};

// Buscar por UUID
User.findByUuid = async function(uuid) {
  return await this.findOne({ where: { uuid } });
};

// ASSOCIAÇÕES
User.associate = function(models) {
  User.hasMany(models.Media, {
    foreignKey: 'userId',
    as: 'media',
    onDelete: 'CASCADE'
  });

  User.hasMany(models.Tag, {
    foreignKey: 'userId',
    as: 'tags',
    onDelete: 'CASCADE'
  });
};

module.exports = User;
