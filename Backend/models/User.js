// models/User.js
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
  
  // UUID gerado automaticamente na criação
  uuid: {
    type: DataTypes.UUID,
    defaultValue: () => uuidv4(),
    allowNull: false,
    unique: true,
    comment: 'Identificador único universal - gerado automaticamente na criação'
  },
  
  // EMAIL - OBRIGATÓRIO e ÚNICO
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
  
  // SENHA - OBRIGATÓRIO (será hasheada automaticamente)
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
  
  // USERNAME - OPCIONAL, mas único quando preenchido
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
    comment: 'Nome de usuário único - opcional, pode ser preenchido depois'
  },
  
  // NAME - OPCIONAL
  name: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Nome completo do usuário - opcional'
  },
  
  // PROFILE_PIC - Caminho físico no servidor
  profile_pic: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: null,
    comment: 'Caminho físico da foto de perfil no servidor: ./uploads/{uuid}/profile.jpg'
  },
  
  // DESCRIPTION - OPCIONAL
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
  
  // TIMESTAMP_CREATED - Gerado automaticamente na criação
  timestamp_created: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: 'Data e hora de criação da conta - gerado automaticamente'
  }
}, {
  tableName: 'users',
  timestamps: false, // Desabilita createdAt/updatedAt padrão do Sequelize
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

// ==========================================
// HOOKS - Executados automaticamente
// ==========================================

// Hook: Hash de senha ANTES de criar usuário
User.beforeCreate(async (user) => {
  if (user.senha) {
    const salt = await bcrypt.genSalt(10);
    user.senha = await bcrypt.hash(user.senha, salt);
  }
});

// Hook: Hash de senha ANTES de atualizar usuário (se senha foi alterada)
User.beforeUpdate(async (user) => {
  if (user.changed('senha')) {
    const salt = await bcrypt.genSalt(10);
    user.senha = await bcrypt.hash(user.senha, salt);
  }
});

// ==========================================
// MÉTODOS DE INSTÂNCIA
// ==========================================

// Método: Validar senha no login
User.prototype.validPassword = async function(senha) {
  return await bcrypt.compare(senha, this.senha);
};

// Método: Obter caminho da pasta do usuário
User.prototype.getUserFolder = function() {
  return `./uploads/${this.uuid}`;
};

// Método: Obter caminho completo da foto de perfil
User.prototype.getProfilePicPath = function() {
  return this.profile_pic || null;
};

// Método: Verificar se perfil está completo
User.prototype.isProfileComplete = function() {
  return !!(this.user && this.name && this.profile_pic);
};

// Método: Serializar sem expor senha
User.prototype.toJSON = function() {
  const values = { ...this.get() };
  delete values.senha; // Remove senha do retorno JSON
  return values;
};

// ==========================================
// MÉTODOS ESTÁTICOS (da classe)
// ==========================================

// Método estático: Buscar por email
User.findByEmail = async function(email) {
  return await this.findOne({ where: { email } });
};

// Método estático: Buscar por username
User.findByUsername = async function(username) {
  return await this.findOne({ where: { user: username } });
};

// Método estático: Buscar por UUID
User.findByUuid = async function(uuid) {
  return await this.findOne({ where: { uuid } });
};

//Atualizar perfil do usuário
User.updateProfile = async function(profileData) {
  const user = await this.findByEmail(profileData.email);
  
};

module.exports = User;
