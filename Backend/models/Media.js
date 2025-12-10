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
    comment: 'Identificador unico da midia'
  },

  type: {
    type: DataTypes.ENUM('image', 'video', 'audio'),
    allowNull: false,
    comment: 'Tipo de midia'
  },

  url: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'URL publica do S3'
  },

  s3_key: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Chave S3 para delecao'
  },

  thumbnail_url: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'URL publica da thumbnail no S3 150x150px WebP'
  },

  thumbnail_s3_key: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Chave S3 da thumbnail para delecao'
  },

  // Campo para armazenar versoes de qualidade do video
  video_versions: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: null,
    comment: 'Versoes de qualidade do video 1080p 720p 480p com URLs e metadados'
  },

  // Status do processamento de video
  processing_status: {
    type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed'),
    allowNull: true,
    defaultValue: null,
    comment: 'Status do processamento de transcodificacao do video'
  },

  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    },
    onDelete: 'CASCADE',
    comment: 'ID do usuario proprietario'
  },

  title: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      len: {
        args: [0, 255],
        msg: 'Titulo deve ter no maximo 255 caracteres'
      }
    },
    comment: 'Titulo opcional da midia'
  },

  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    validate: {
      len: {
        args: [0, 1000],
        msg: 'Descricao deve ter no maximo 1000 caracteres'
      }
    },
    comment: 'Descricao opcional da midia'
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
    comment: 'Metadados extraidos do arquivo dimensoes EXIF duracao etc'
  },

  active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    comment: 'Soft delete false igual na lixeira'
  },

  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: 'Data de criacao'
  },

  updated_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: 'Data de ultima atualizacao'
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
    },
    {
      fields: ['processing_status'],
      name: 'media_processing_status_index'
    }
  ]
});

// HOOKS

// Atualizar updated_at antes de cada update
Media.beforeUpdate((media) => {
  media.updated_at = new Date();
});

// METODOS ESTATICOS

// Buscar por UUID
Media.findByUuid = async function(uuid) {
  return await this.findOne({ where: { uuid } });
};

// Buscar midias ativas do usuario
Media.findActiveByUserId = async function(userId, type = null) {
  const where = { userId, active: true };
  if (type) where.type = type;

  return await this.findAll({
    where,
    order: [['created_at', 'DESC']]
  });
};

// Contar midias por tipo
Media.countByType = async function(userId, type) {
  return await this.count({
    where: { userId, type, active: true }
  });
};

// Buscar videos pendentes de processamento
Media.findPendingVideoProcessing = async function() {
  return await this.findAll({
    where: {
      type: 'video',
      processing_status: 'pending',
      active: true
    },
    order: [['created_at', 'ASC']]
  });
};

// METODOS DE INSTANCIA

// Soft delete
Media.prototype.softDelete = async function() {
  return await this.update({ active: false });
};

// Restaurar da lixeira
Media.prototype.restore = async function() {
  return await this.update({ active: true });
};

// Atualizar versoes de video
Media.prototype.updateVideoVersions = async function(versions, status = 'completed') {
  return await this.update({
    video_versions: versions,
    processing_status: status
  });
};

// Obter URL da qualidade especifica ou padrao 1080p
Media.prototype.getVideoUrl = function(quality = '1080p') {
  // Se nao for video retorna URL original
  if (this.type !== 'video') {
    return this.url;
  }
  
  // Se nao tem versoes processadas retorna original
  if (!this.video_versions || !Array.isArray(this.video_versions) || this.video_versions.length === 0) {
    return this.url;
  }
  
  // Procura a qualidade solicitada
  const version = this.video_versions.find(v => v.quality === quality);
  if (version) {
    return version.url;
  }
  
  // Se nao encontrou a qualidade solicitada tenta encontrar a melhor disponivel
  const preferenceOrder = ['1080p', '720p', '480p'];
  for (const q of preferenceOrder) {
    const fallback = this.video_versions.find(v => v.quality === q);
    if (fallback) {
      return fallback.url;
    }
  }
  
  // Fallback para URL original
  return this.url;
};

// Obter todas as qualidades disponiveis
Media.prototype.getAvailableQualities = function() {
  if (this.type !== 'video') {
    return [];
  }
  
  const qualities = [];
  
  // Sempre inclui original
  qualities.push({
    quality: 'original',
    label: 'Original',
    url: this.url,
    width: this.metadata?.width || null,
    height: this.metadata?.height || null
  });
  
  // Adiciona versoes processadas
  if (this.video_versions && Array.isArray(this.video_versions)) {
    this.video_versions.forEach(v => {
      qualities.push({
        quality: v.quality,
        label: v.label,
        url: v.url,
        width: v.width,
        height: v.height
      });
    });
  }
  
  return qualities;
};

// ASSOCIACOES
Media.associate = function(models) {
  Media.belongsTo(models.User, {
    foreignKey: 'userId',
    as: 'user'
  });

  // Associacao com Tags N:N
  Media.belongsToMany(models.Tag, {
    through: 'MediaTags',
    foreignKey: 'mediaId',
    otherKey: 'tagId',
    as: 'tags'
  });
};

module.exports = Media;
