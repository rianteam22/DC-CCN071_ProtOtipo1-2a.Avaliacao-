// SGM - Sistema de Gerenciamento Multimídia
// Backend com suporte a Tags para categorização

const express = require('express');
const app = express();
const sequelize = require('./config/database');
const User = require('./models/User');
const Media = require('./models/Media');
const Tag = require('./models/Tag');
const MediaTag = require('./models/MediaTag');
const upload = require('./config/upload');
const mediaRoutes = require('./routes/mediaRoutes');
const tagRoutes = require('./routes/tagRoutes');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const path = require('path');

require('dotenv').config();

const PORT = process.env.PORT || 3333;
const NODE_ENV = process.env.NODE_ENV || 'development';

console.log(`🔧 Ambiente: ${NODE_ENV}`);

// Middleware
app.use(cors());
app.use(express.json());

// Servir arquivos estáticos do frontend
app.use(express.static(path.join(__dirname, '..', 'FrontEnd')));

// Middleware de autenticação JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido' });
    }

    req.user = user;
    next();
  });
}

// ============================================
// ROTAS DA API
// ============================================

// Media routes (todas requerem autenticação)
app.use('/api/media', authenticateToken, mediaRoutes);

// Tag routes (todas requerem autenticação) 
app.use('/api/tags', authenticateToken, tagRoutes);

// ============================================
// ROTAS DE PERFIL
// ============================================

// GET - Foto de perfil (retorna URL do S3)
app.get('/profile/photo/:user', async (req, res) => {
  try {
    const { user } = req.params;

    const usuario = await User.findByUuid(user);

    if (!usuario || !usuario.profile_pic) {
      return res.status(404).json({ error: 'Foto não encontrada' });
    }

    res.json({
      url: usuario.profile_pic
    });

  } catch (error) {
    console.error('Erro ao buscar foto de perfil:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET - Dados do usuário autenticado
app.get('/profile/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    res.json({
      user: user.toJSON()
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ROTAS DE AUTENTICAÇÃO
// ============================================

// POST - Login
app.post('/login', async (req, res) => {
  try {
    const { email, senha } = req.body;
    
    const user = await User.findByEmail(email);
    
    if (!user) {
      return res.status(401).json({ error: 'Email ou senha incorretos' });
    }
    
    const senhaValida = await user.validPassword(senha);
    if (!senhaValida) {
      return res.status(401).json({ error: 'Email ou senha incorretos' });
    }
    
    const token = jwt.sign(
      { id: user.id, email: user.email, uuid: user.uuid },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );
    
    res.json({
      message: 'Login realizado com sucesso!',
      token: token,
      user: user.toJSON()
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST - Registro
app.post('/register', async (req, res) => {
  try {
    const { email, senha } = req.body;
    
    if (!email || !senha) {
      return res.status(400).json({ 
        error: 'Email e senha são obrigatórios' 
      });
    }
    
    const emailExiste = await User.findByEmail(email);
    if (emailExiste) {
      return res.status(400).json({ 
        error: 'Email já cadastrado' 
      });
    }
    
    const novoUsuario = await User.create({
      email,
      senha 
    });

    const token = jwt.sign(
      { id: novoUsuario.id, email: novoUsuario.email, uuid: novoUsuario.uuid },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );
    
    res.status(201).json({
      message: 'Conta criada com sucesso!',
      token: token,
      user: novoUsuario.toJSON() 
    });
    
  } catch (error) {
    console.error('Erro ao criar conta:', error);
    res.status(500).json({ 
      error: 'Erro ao criar conta',
      details: error.message 
    });
  }
});

// POST - Upload de foto de perfil
app.post('/profile/upload-photo', authenticateToken, upload.single('profile_pic'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo foi enviado' });
    }

    const usuario = await User.findByPk(req.user.id);

    if (!usuario) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // multer-s3 retorna a URL do arquivo em req.file.location
    const profilePicUrl = req.file.location;

    await usuario.update({
      profile_pic: profilePicUrl
    });

    res.json({
      message: 'Foto de perfil atualizada com sucesso!',
      file: {
        key: req.file.key,
        url: profilePicUrl,
        bucket: req.file.bucket
      },
      user: usuario.toJSON()
    });

  } catch (error) {
    console.error('Erro ao fazer upload:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT - Atualizar perfil
app.put('/profile/update', authenticateToken, async (req, res) => {
  try {
    const { 
      novoEmail,
      novaSenha,
      name, 
      user,
      description,
      senhaAtual
    } = req.body;
    
    const usuario = await User.findByPk(req.user.id);
    
    if (!usuario) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    const alteracoes = [];
    
    // Validações de segurança
    if ((novoEmail && novoEmail !== usuario.email) || novaSenha) {
      if (!senhaAtual) {
        return res.status(400).json({ 
          error: 'Senha atual é obrigatória para alterar email ou senha' 
        });
      }
      
      const senhaValida = await usuario.validPassword(senhaAtual);
      if (!senhaValida) {
        return res.status(401).json({ error: 'Senha atual incorreta' });
      }
    }
    
    const updates = {};
    
    // Validar user
    if (user && user !== usuario.user) {
      const userExists = await User.findByUsername(user);
      if (userExists) {
        return res.status(400).json({ error: 'Username já cadastrado' });
      }
      updates.user = user;
      alteracoes.push('username');
    }
    
    // Validar email
    if (novoEmail && novoEmail !== usuario.email) {
      const emailExists = await User.findByEmail(novoEmail);
      if (emailExists) {
        return res.status(400).json({ error: 'Email já cadastrado' });
      }
      updates.email = novoEmail;
      alteracoes.push('email');
    }
    
    // Validar e atualizar senha
    if (novaSenha) {
      if (novaSenha.length < 6) {
        return res.status(400).json({ 
          error: 'Nova senha deve ter no mínimo 6 caracteres' 
        });
      }
      updates.senha = novaSenha; 
      alteracoes.push('senha');
    }
    
    // Atualizar campos de perfil
    if (name !== undefined && name !== usuario.name) {
      updates.name = name;
      alteracoes.push('nome');
    }
    
    if (description !== undefined && description !== usuario.description) {
      updates.description = description;
      alteracoes.push('descrição');
    }
    
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ 
        message: 'Nenhuma alteração detectada' 
      });
    }
    
    await usuario.update(updates);
    
    res.json({
      message: 'Perfil atualizado com sucesso!',
      alteracoes: alteracoes, 
      user: usuario.toJSON()
    });
    
  } catch (error) {
    console.error('Erro ao atualizar perfil:', error);
    res.status(500).json({ 
      error: 'Erro ao atualizar perfil',
      details: error.message 
    });
  }
});

// ============================================
// INICIALIZAÇÃO DO BANCO DE DADOS
// ============================================

async function initDatabase() {
  try {
    await sequelize.authenticate();
    console.log('✅ Conexão com banco de dados estabelecida');
    console.log(`   Dialect: ${sequelize.getDialect()}`);

    // Inicializar associações entre modelos
    const models = { User, Media, Tag, MediaTag };
    
    Object.keys(models).forEach(modelName => {
      if (models[modelName].associate) {
        models[modelName].associate(models);
      }
    });

    console.log('✅ Associações de modelos inicializadas');

    // NÃO usar sync aqui - use npm run init-db para criar/alterar tabelas
    // O sync({ alter: true }) causa problemas com constraints no SQLite

  } catch (error) {
    console.error('❌ Erro ao conectar ao banco:', error);
    process.exit(1);
  }
}

// ============================================
// INICIAR SERVIDOR
// ============================================

initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`   URL: http://localhost:${PORT}`);
  });
});
