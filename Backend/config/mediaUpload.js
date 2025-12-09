const multer = require('multer');
const multerS3 = require('multer-s3');
const s3Client = require('./s3');
const { DeleteObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const path = require('path');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

require('dotenv').config();

// Configurações de tipos de arquivo
const FILE_TYPES = {
  image: {
    extensions: /jpeg|jpg|png|gif|webp|svg/,
    mimetypes: /^image\/(jpeg|jpg|png|gif|webp|svg\+xml)$/,
    maxSize: 5 * 1024 * 1024, // 5MB
    folder: 'imagens'
  },
  video: {
    extensions: /mp4|mov|avi|webm|mkv/,
    mimetypes: /^video\/(mp4|quicktime|x-msvideo|webm|x-matroska)$/,
    maxSize: 100 * 1024 * 1024, // 100MB
    folder: 'videos'
  },
  audio: {
    extensions: /mp3|wav|ogg|m4a|aac|flac/,
    mimetypes: /^audio\/(mpeg|wav|ogg|mp4|aac|x-m4a|flac|x-flac)$/,
    maxSize: 20 * 1024 * 1024, // 20MB
    folder: 'audios'
  }
};

// Função helper para determinar tipo de mídia
function getMediaType(mimetype) {
  if (FILE_TYPES.image.mimetypes.test(mimetype)) return 'image';
  if (FILE_TYPES.video.mimetypes.test(mimetype)) return 'video';
  if (FILE_TYPES.audio.mimetypes.test(mimetype)) return 'audio';
  return null;
}

// Storage S3 para mídia
const storage = multerS3({
  s3: s3Client,
  bucket: process.env.AWS_BUCKET_NAME,
  contentType: multerS3.AUTO_CONTENT_TYPE,
  metadata: function (req, file, cb) {
    cb(null, {
      fieldName: file.fieldname,
      originalName: file.originalname
    });
  },
  key: async function (req, file, cb) {
    try {
      // Validar JWT
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];

      if (!token) {
        return cb(new Error('Token não fornecido. Faça login novamente.'));
      }

      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch (error) {
        return cb(new Error('Token inválido ou expirado. Faça login novamente.'));
      }

      const usuario = await User.findByPk(decoded.id);

      if (!usuario) {
        return cb(new Error('Usuário não encontrado'));
      }

      // Armazenar usuário no request
      req.uploadUser = usuario;

      // Determinar tipo de mídia
      const mediaType = getMediaType(file.mimetype);
      if (!mediaType) {
        return cb(new Error('Tipo de arquivo não suportado'));
      }

      // Obter pasta correspondente
      const folder = FILE_TYPES[mediaType].folder;

      // Gerar chave: uploads/{uuid_user}/{folder}/{timestamp}_{filename}
      const timestamp = Date.now();
      const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      const key = `uploads/${usuario.uuid}/${folder}/${timestamp}_${sanitizedFilename}`;

      // Armazenar tipo e filename no request para uso posterior
      req.mediaType = mediaType;
      req.originalFilename = file.originalname;

      cb(null, key);

    } catch (error) {
      console.error('Erro no upload de mídia:', error);
      cb(new Error('Erro ao processar upload: ' + error.message));
    }
  }
});

// Filtro de tipo de arquivo (aceita imagem, vídeo e áudio)
const fileFilter = (req, file, cb) => {
  const mediaType = getMediaType(file.mimetype);

  if (!mediaType) {
    return cb(new Error('Tipo de arquivo não suportado. Apenas imagens, vídeos e áudios são permitidos.'));
  }

  // Validar extensão
  const config = FILE_TYPES[mediaType];
  const ext = path.extname(file.originalname).toLowerCase().substring(1);

  if (!config.extensions.test(ext)) {
    return cb(new Error(`Extensão .${ext} não permitida para ${mediaType}`));
  }

  cb(null, true);
};

// Configuração final do multer para mídia
const mediaUpload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // Limite máximo global (100MB - vídeos)
  },
  fileFilter: fileFilter
});

// Middleware customizado para validar tamanho após upload
const validateMediaSize = async (req, res, next) => {
  if (!req.file) {
    return next();
  }

  try {
    // multer-s3 não fornece o tamanho real do arquivo
    // Precisamos obter via HeadObject do S3
    const headParams = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: req.file.key
    };

    const headResponse = await s3Client.send(new HeadObjectCommand(headParams));
    const fileSize = headResponse.ContentLength;

    // Armazenar o tamanho real no req.file
    req.file.size = fileSize;

    const mediaType = req.mediaType;
    const config = FILE_TYPES[mediaType];

    if (fileSize > config.maxSize) {
      // Arquivo muito grande, deletar do S3
      const deleteParams = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: req.file.key
      };

      await s3Client.send(new DeleteObjectCommand(deleteParams));

      const maxSizeMB = config.maxSize / (1024 * 1024);
      return res.status(400).json({
        error: `Arquivo ${mediaType} muito grande. Tamanho máximo: ${maxSizeMB}MB`
      });
    }

    next();
  } catch (error) {
    console.error('Erro ao validar tamanho do arquivo:', error);
    // Em caso de erro, tentar usar Content-Length do header como fallback
    const contentLength = parseInt(req.headers['content-length']) || 0;
    req.file.size = contentLength;
    next();
  }
};

module.exports = {
  mediaUpload,
  validateMediaSize,
  FILE_TYPES,
  getMediaType
};
