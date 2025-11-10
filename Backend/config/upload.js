const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

require('dotenv').config();

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
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
      
      const usuario = await User.findByPk(decoded.id); // Buscar user pelo token id
      
      if (!usuario) {
        return cb(new Error('Usuário não encontrado'));
      }
      
      const userFolder = path.join('./uploads', usuario.uuid); //fazer a pasta do usuario
      
      if (!fs.existsSync(userFolder)) {
        fs.mkdirSync(userFolder, { recursive: true });
      }
      
      req.uploadUser = usuario;
      
      cb(null, userFolder);
      
    } catch (error) {
      console.error('Erro no upload:', error);
      cb(new Error('Erro ao processar upload: ' + error.message));
    }
  },
  
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `profile${ext}`); // retorna o profile com a extensão 
  }
});

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
