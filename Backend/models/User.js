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
  
  // UUID na criação
  uuid: {
    type: DataTypes.UUID,
    defaultValue: () => uuidv4(),
    allowNull: false,
    unique: true,
    comment: 'Identificador único universal - gerado automaticamente na criação'
  },
  
  // EMAIL - OBRIGATÓRIO 
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
  
  // SENHA - OBRIGATÓRIO 
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
  
  // USERNAME 
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
  
  // NAME 
  name: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Nome completo do usuário - opcional'
  },
  
  // PROFILE_PIC 
  profile_pic: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: null,
    comment: 'Caminho físico da foto de perfil no servidor: ./uploads/{uuid}/profile.jpg'
  },
  
  // DESCRIPTION 
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
  
  // TIMESTAMP_CREATED 
  timestamp_created: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: 'Data e hora de criação da conta - gerado automaticamente'
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

// Hook: Hash de senha 
User.beforeCreate(async (user) => {
  if (user.senha) {
    const salt = await bcrypt.genSalt(10);
    user.senha = await bcrypt.hash(user.senha, salt);
  }
});

// Hook: Hash de senha 
User.beforeUpdate(async (user) => {
  if (user.changed('senha')) {
    const salt = await bcrypt.genSalt(10);
    user.senha = await bcrypt.hash(user.senha, salt);
  }
});

// MÉTODOS DE INSTÂNCIA

// Método: Validar senha no login
User.prototype.validPassword = async function(senha) {
  return await bcrypt.compare(senha, this.senha);
};

//Método: Obter URL da foto de perfil (agora retorna URL do S3)
User.prototype.getProfilePicPath = function() {
  return this.profile_pic || null;
};

// Método: Verificar se perfil está completo
User.prototype.isProfileComplete = function() {
  return !!(this.user && this.name && this.profile_pic);
};

// Método: json sem campo senha
User.prototype.toJSON = function() {
  const values = { ...this.get() };
  delete values.senha; 
  return values;
};


// Método: Buscar por email
User.findByEmail = async function(email) {
  return await this.findOne({ where: { email } });
};

// Método: Buscar por username
User.findByUsername = async function(username) {
  return await this.findOne({ where: { user: username } });
};

// Método: Buscar por UUID
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
};

module.exports = User;
