const express = require('express');
const router = express.Router();
const tagController = require('../controllers/tagController');

// Todas as rotas requerem autenticação (middleware aplicado no index.js)

// GET /tags - Listar todas as tags do usuário
router.get('/', tagController.listUserTags);

// POST /tags - Criar nova tag
router.post('/', tagController.createTag);

// PUT /tags/:uuid - Atualizar tag
router.put('/:uuid', tagController.updateTag);

// DELETE /tags/:uuid - Deletar tag
router.delete('/:uuid', tagController.deleteTag);

// POST /tags/:uuid/media/:mediaUuid - Adicionar tag a uma mídia
router.post('/:uuid/media/:mediaUuid', tagController.addTagToMedia);

// DELETE /tags/:uuid/media/:mediaUuid - Remover tag de uma mídia
router.delete('/:uuid/media/:mediaUuid', tagController.removeTagFromMedia);

module.exports = router;
