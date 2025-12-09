const multer = require('multer');
const multerS3 = require('multer-s3');
const { S3Client } = require('@aws-sdk/client-s3');
const path = require('path');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

require('dotenv').config();

// Configurar cliente S3
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

// Configurar storage do Multer com S3
const storage = multerS3({
  s3: s3Client,
  bucket: process.env.AWS_BUCKET_NAME,
  contentType: multerS3.AUTO_CONTENT_TYPE,
  metadata: function (req, file, cb) {
    cb(null, { fieldName: file.fieldname });
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

      // Armazenar usuário no request para uso posterior
      req.uploadUser = usuario;

      // Gerar chave do arquivo no S3: uploads/{uuid}/profile.{ext}
      const ext = path.extname(file.originalname);
      const key = `uploads/${usuario.uuid}/profile${ext}`;

      cb(null, key);

    } catch (error) {
      console.error('Erro no upload:', error);
      cb(new Error('Erro ao processar upload: ' + error.message));
    }
  }
});

// Filtro de tipo de arquivo (apenas imagens)
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  }

  cb(new Error('Apenas imagens são permitidas (jpg, png, gif, webp)'));
};

// Configuração final do multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // Máximo 5MB
  },
  fileFilter: fileFilter
});

module.exports = upload;
