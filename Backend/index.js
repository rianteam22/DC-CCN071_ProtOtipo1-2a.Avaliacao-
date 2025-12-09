//TODO 
// ROTAS DE GET (user info e foto de perfil)
// TODO GET FILES DO BUCKET S3
// ROTAS DE POST (login, register, upload de foto de perfil)
// TODO POST FILES NO BUCKET S3
// ROTAS DE PUT (profile update)
// TODO PUT PROFILE
// ROTAS DE DELETE
// TODO DELETE PROFILE
// AUTENTICAÇÃO (jwt implementado)
// TODO UUID E EMAIL UNICOS (implementado)
// MIDDLEWARES (cors, json, autenticação)
// TODO CHECAGEM DE TIPO DE FILES
// CONEXÃO COM BANCO DE DADOS (sequelize orm, sqlite database)
// TODO CRIPTOGRAFIA DE SENHAS (hash e salting com bcrypt)
// TODO TESTES
// TODO TESTES UNITÁRIOS E DE INTEGRAÇÃO

// SCHEMA BANCO DE DADOS
// EMAIL / USER / SENHA / NAME / PROFILE_PIC / DESCRIPTION / TIMESTAMP_CREATED / UUID

const express = require('express');
const app = express();
const sequelize = require('./config/database');
const User = require('./models/User')
const upload = require('./config/upload');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const path = require('path');

require('dotenv').config();



const PORT = process.env.PORT || 3333;

//middleware
app.use(cors());
app.use(express.json());

// Servir arquivos estáticos do frontend
app.use(express.static(path.join(__dirname, '..', 'FrontEnd')));

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token){
    return res.sendStatus(401).json({ error: 'Token não fornecido' });
  }
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err){
      return res.sendStatus(403).json({ error: 'Token inválido' });
    }
    
    req.user = user;
    next();
    
  });
}

//GETs
// Rota para ver a foto (retorna URL do S3)
app.get('/profile/photo/:user', async (req, res) => {
  try {
    const { user } = req.params;

    // Buscar usuário
    const usuario = await User.findByUuid(user);

    if (!usuario || !usuario.profile_pic) {
      return res.status(404).json({ error: 'Foto não encontrada' });
    }

    // Retornar URL do S3 armazenada no banco
    res.json({
      url: usuario.profile_pic
    });

  } catch (error) {
    console.error('Erro ao buscar foto de perfil:', error);
    res.status(500).json({ error: error.message });
  }
});

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

//POSTs
app.post('/login', async (req, res) => {
  try {
    const { email, senha } = req.body;
    
    const user = await User.findByEmail(email);
    
    if(!user){
      return res.status(401).json({ error: 'Email ou senha incorretos' });
    }
    const senhaValida = await user.validPassword(senha);
    if(!senhaValida){
      return res.status(401).json({ error: 'Email ou senha incorretos' });
    }
    
    const token = jwt.sign(
      { id: user.id, email: user.email, uuid: user.uuid},
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
    
    res.status(201).json({
      message: 'Conta criada com sucesso!',
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
        key: req.file.key,           // Chave no S3: uploads/uuid/profile.jpg
        url: profilePicUrl,          // URL pública do S3
        bucket: req.file.bucket      // Nome do bucket
      },
      user: usuario.toJSON()
    });

  } catch (error) {
    console.error('Erro ao fazer upload:', error);
    res.status(500).json({ error: error.message });
  }
});



//PUTs
app.put('/profile/update', authenticateToken, async (req, res) => {
  try {
    const { 
      novoEmail,       // Novo email (opcional)
      novaSenha,       // Nova senha (opcional)
      name, 
      user,            // username
      description,
      senhaAtual       // Senha atual para validação
    } = req.body;
    
    const usuario = await User.findByPk(req.user.id);
    
    if (!usuario) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    //lista do que atualizou
    const alteracoes = [];
    
    // VALIDAÇÕES DE SEGURANÇA 
    // validar senha
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
    
    // atualizações a serem feitas
    const updates = {};
    
    // validar user
    if (user && user !== usuario.user) {
      const userExists = await User.findByUsername(user);
      if (userExists) {
        return res.status(400).json({ error: 'Username já cadastrado' });
      }
      updates.user = user;
      alteracoes.push('username');
    }
    
    // validar email
    if (novoEmail && novoEmail !== usuario.email) {
      const emailExists = await User.findByEmail(novoEmail);
      if (emailExists) {
        return res.status(400).json({ error: 'Email já cadastrado' });
      }
      updates.email = novoEmail;
      alteracoes.push('email');
    }
    
    // validar e atualizar senha
    if (novaSenha) {
      if (novaSenha.length < 6) {
        return res.status(400).json({ 
          error: 'Nova senha deve ter no mínimo 6 caracteres' 
        });
      }
      updates.senha = novaSenha; 
      alteracoes.push('senha');
    }
    
    //Atualizar campos de perfil 
    if (name !== undefined && name !== usuario.name) {
      updates.name = name;
      alteracoes.push('nome');
    }
    
    if (description !== undefined && description !== usuario.description) {
      updates.description = description;
      alteracoes.push('descrição');
    }
    
    // VERIFICAR SE HÁ MUDANÇAS A SEREM FEITAS
    
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ 
        message: 'Nenhuma alteração detectada' 
      });
    }
    
    //APLICAR TODAS AS ALTERAÇÕES
    
    await usuario.update(updates);
    
    // RESPONSE
    
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

// INICIALIZAR BANCO DE DADOS
async function initDatabase() {
  try {
    await sequelize.authenticate();
    console.log(' Conexão com banco de dados estabelecida');
    
    await sequelize.sync({ alter: true });
    console.log(' Modelos sincronizados');
    
  } catch (error) {
    console.error('Erro ao conectar ao banco:', error);
    process.exit(1);
  }
}

initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
  });
});