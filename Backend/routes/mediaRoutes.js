const express = require('express');
const router = express.Router();
const { mediaUpload, validateMediaSize } = require('../config/mediaUpload');
const mediaController = require('../controllers/mediaController');

// Todas as rotas requerem autenticação (middleware aplicado no index.js)

// POST /media/upload - Upload de nova mídia
router.post('/upload',
  mediaUpload.single('media'),
  validateMediaSize,
  mediaController.uploadMedia
);

// GET /media - Listar mídias do usuário
// Query params: ?type=image|video|audio&active=true|false&tag=uuid&tags=[uuid1,uuid2]&search=termo
router.get('/', mediaController.listUserMedia);

// GET /media/:uuid - Buscar mídia específica
router.get('/:uuid', mediaController.getMediaByUuid);

// GET /media/:uuid/tags - Listar tags de uma mídia
router.get('/:uuid/tags', mediaController.getMediaTags);

// PUT /media/:uuid - Atualizar title/description/tags
router.put('/:uuid', mediaController.updateMedia);

// DELETE /media/:uuid - Deletar mídia
// Query params: ?permanent=true (para hard delete)
router.delete('/:uuid', mediaController.deleteMedia);

module.exports = router;
