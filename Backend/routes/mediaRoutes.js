const express = require('express');
const router = express.Router();
const { mediaUpload, uploadToS3, validateMediaSize } = require('../config/mediaUpload');
const mediaController = require('../controllers/mediaController');

// Todas as rotas requerem autenticacao - middleware aplicado no index.js

// POST /media/upload - Upload de nova midia
// Ordem: multer processa arquivo na memoria -> uploadToS3 envia para S3 -> controller salva no banco
router.post('/upload',
  mediaUpload.single('media'),
  uploadToS3,
  validateMediaSize,
  mediaController.uploadMedia
);

// GET /media - Listar midias do usuario
// Query params: ?type=image|video|audio&active=true|false&tag=uuid&tags=[uuid1,uuid2]&search=termo
router.get('/', mediaController.listUserMedia);

// GET /media/:uuid - Buscar midia especifica
router.get('/:uuid', mediaController.getMediaByUuid);

// GET /media/:uuid/tags - Listar tags de uma midia
router.get('/:uuid/tags', mediaController.getMediaTags);

// PUT /media/:uuid - Atualizar title/description/tags
router.put('/:uuid', mediaController.updateMedia);

// DELETE /media/:uuid - Deletar midia
// Query params: ?permanent=true para hard delete
router.delete('/:uuid', mediaController.deleteMedia);

module.exports = router;