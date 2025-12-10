const multer = require('multer');
const { Upload } = require('@aws-sdk/lib-storage');
const s3Client = require('./s3');
const path = require('path');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

require('dotenv').config();

// Configuracoes de tipos de arquivo
const FILE_TYPES = {
  image: {
    extensions: /jpeg|jpg|png|gif|webp|svg/,
    mimetypes: /^image\/(jpeg|jpg|png|gif|webp|svg\+xml)$/,
    maxSize: 5 * 1024 * 1024,
    folder: 'imagens'
  },
  video: {
    extensions: /mp4|mov|avi|webm|mkv/,
    mimetypes: /^video\/(mp4|quicktime|x-msvideo|webm|x-matroska)$/,
    maxSize: 100 * 1024 * 1024,
    folder: 'videos'
  },
  audio: {
    extensions: /mp3|wav|ogg|m4a|aac|flac/,
    mimetypes: /^audio\/(mpeg|wav|ogg|mp4|aac|x-m4a|flac|x-flac)$/,
    maxSize: 20 * 1024 * 1024,
    folder: 'audios'
  }
};

// Funcao helper para determinar tipo de midia
function getMediaType(mimetype) {
  if (FILE_TYPES.image.mimetypes.test(mimetype)) return 'image';
  if (FILE_TYPES.video.mimetypes.test(mimetype)) return 'video';
  if (FILE_TYPES.audio.mimetypes.test(mimetype)) return 'audio';
  return null;
}

// Usar memoria temporaria em vez de multer-s3
const storage = multer.memoryStorage();

// Filtro de tipo de arquivo
const fileFilter = (req, file, cb) => {
  const mediaType = getMediaType(file.mimetype);

  if (!mediaType) {
    return cb(new Error('Tipo de arquivo nao suportado. Apenas imagens videos e audios sao permitidos.'));
  }

  const config = FILE_TYPES[mediaType];
  const ext = path.extname(file.originalname).toLowerCase().substring(1);

  if (!config.extensions.test(ext)) {
    return cb(new Error(`Extensao .${ext} nao permitida para ${mediaType}`));
  }

  cb(null, true);
};

// Configuracao do multer para memoria
const mediaUpload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024
  },
  fileFilter: fileFilter
});

// Middleware para fazer upload para S3 apos multer processar
const uploadToS3 = async (req, res, next) => {
  if (!req.file) {
    return next();
  }

  try {
    // Validar JWT
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Token nao fornecido' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(401).json({ error: 'Token invalido ou expirado' });
    }

    const usuario = await User.findByPk(decoded.id);
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario nao encontrado' });
    }

    // Determinar tipo de midia
    const mediaType = getMediaType(req.file.mimetype);
    if (!mediaType) {
      return res.status(400).json({ error: 'Tipo de arquivo nao suportado' });
    }

    // Validar tamanho
    const config = FILE_TYPES[mediaType];
    if (req.file.size > config.maxSize) {
      const maxSizeMB = config.maxSize / (1024 * 1024);
      return res.status(400).json({ 
        error: `Arquivo ${mediaType} muito grande. Maximo ${maxSizeMB}MB` 
      });
    }

    // Gerar chave S3
    const folder = config.folder;
    const timestamp = Date.now();
    const sanitizedFilename = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `uploads/${usuario.uuid}/${folder}/${timestamp}_${sanitizedFilename}`;

    console.log(`Fazendo upload para S3: ${key}`);

    // Upload usando aws-sdk lib-storage
    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype
      }
    });

    await upload.done();

    // Construir URL publica
    const region = process.env.AWS_REGION;
    const bucket = process.env.AWS_BUCKET_NAME;
    const location = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

    console.log(`Upload concluido: ${location}`);

    // Adicionar informacoes ao req.file no formato esperado pelo controller
    req.file.key = key;
    req.file.location = location;
    req.file.bucket = bucket;
    
    // Adicionar informacoes extras ao request
    req.uploadUser = usuario;
    req.mediaType = mediaType;
    req.originalFilename = req.file.originalname;

    next();

  } catch (error) {
    console.error('Erro no upload para S3:', error);
    return res.status(500).json({ 
      error: 'Erro ao fazer upload do arquivo',
      details: error.message 
    });
  }
};

// Middleware de validacao de tamanho - ja feito no uploadToS3
const validateMediaSize = async (req, res, next) => {
  next();
};

module.exports = {
  mediaUpload,
  uploadToS3,
  validateMediaSize,
  FILE_TYPES,
  getMediaType
};