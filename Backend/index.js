//TODO 
// ROTAS DE GET
// TODO GET FILES DO BUCKET S3
// ROTAS DE POST
// TODO POST FILES NO BUCKET S3
// ROTAS DE PUT
// TODO PUT PROFILE
// ROTAS DE DELETE
// TODO DELETE PROFILE
// AUTENTICAÇÃO
// TODO UUID E EMAIL UNICOS
// MIDDLEWARES
// TODO CHECAGEM DE TIPO DE FILES
// CONEXÃO COM BANCO DE DADOS
// TODO CRIPTOGRAFIA DE SENHAS
// TESTES
// TODO TESTES UNITÁRIOS E DE INTEGRAÇÃO

// SCHEMA BANCO DE DADOS
// EMAIL / USER / SENHA / NAME / PROFILE_PIC / DESCRIPTION / TIMESTAMP_CREATED / UUID

const express = require('express');
const app = express();
const sequelize = require('./config/database');
const User = require('./models/User')

const PORT = process.env.PORT || 3333;

//middleware
app.use(express.json());

// INICIALIZAR BANCO DE DADOS
async function initDatabase() {
  try {
    await sequelize.authenticate();
    console.log(' Conexão com banco de dados estabelecida');
    
    // Sincronizar modelos (criar tabelas se não existirem)
    await sequelize.sync({ alter: false });
    console.log(' Modelos sincronizados');
    
  } catch (error) {
    console.error('Erro ao conectar ao banco:', error);
    process.exit(1);
  }
}

//POSTs
app.post('/register', async (req, res) => {
  try {
    const { email, senha } = req.body;
    
    // Validar campos obrigatórios
    if (!email || !senha) {
      return res.status(400).json({ 
        error: 'Email e senha são obrigatórios' 
      });
    }
    
    // Verificar se email já existe
    const emailExiste = await User.findByEmail(email);
    if (emailExiste) {
      return res.status(400).json({ 
        error: 'Email já cadastrado' 
      });
    }
    
    // Criar usuário 
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

app.post('/profile', async (req, res) => {
  const {name, user, email, senha, pic, description} = req.body;

  if (!user || !email || !senha) {
    return res.status(400).json({ 
      error: 'user, email e senha são obrigatórios nao nulos' 
    });
  }

  try {
    const user = {
      name: name,
      user: user,
      email: email,
      senha: senha,
      profile_pic: pic,
      description: description
    }
    
  } catch (error) {
    console.error('Erro ao atualizar perfil:', error);
    res.status(500).json({ 
      error: 'Erro ao atualizar perfil',
      details: error.message 
    });
  }
});