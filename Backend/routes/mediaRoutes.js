const express = require('express');
const router = express.Router();
const { mediaUpload, uploadToS3, validateMediaSize } = require('../config/mediaUpload');
const mediaController = require('../controllers/mediaController');

// Todas as rotas requerem autenticacao middleware aplicado no index.js

// POST /media/upload - Upload de nova midia
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
// Query params: ?quality=1080p|720p|480p|original para obter URL da qualidade
router.get('/:uuid', mediaController.getMediaByUuid);

// GET /media/:uuid/stream - Obter URL de streaming para qualidade especifica
// Query params: ?quality=1080p|720p|480p|original padrao 1080p
router.get('/:uuid/stream', mediaController.getStreamUrl);

// GET /media/:uuid/processing-status - Verificar status do processamento de video
router.get('/:uuid/processing-status', mediaController.getProcessingStatus);

// GET /media/:uuid/tags - Listar tags de uma midia
router.get('/:uuid/tags', mediaController.getMediaTags);

// PUT /media/:uuid - Atualizar title/description/tags
router.put('/:uuid', mediaController.updateMedia);

// POST /media/:uuid/reprocess - Reprocessar video forcar nova transcodificacao
router.post('/:uuid/reprocess', mediaController.reprocessVideo);

// DELETE /media/:uuid - Deletar midia
// Query params: ?permanent=true para hard delete
router.delete('/:uuid', mediaController.deleteMedia);

module.exports = router;
