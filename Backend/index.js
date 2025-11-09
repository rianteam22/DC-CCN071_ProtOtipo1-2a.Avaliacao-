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


//PUTs
// app.js ou routes/user.js

app.put('/profile/update', async (req, res) => {
  try {
    const { 
      emailAtual,      // Email atual para identificar o usuário
      novoEmail,       // Novo email (opcional)
      senhaAtual,      // Senha atual (obrigatória se for mudar email ou senha)
      novaSenha,       // Nova senha (opcional)
      name, 
      user,            // username
      pic, 
      description 
    } = req.body;

    //Buscar usuário
    const usuario = await User.findByEmail(emailAtual);
    
    if (!usuario) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Array para armazenar quais campos foram alterados
    const alteracoes = [];

    // VALIDAÇÕES DE SEGURANÇA 
    // validar senha
    if ((novoEmail && novoEmail !== emailAtual) || novaSenha) {
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

    //PREPARAR ALTERAÇÕES
    
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
    if (novoEmail && novoEmail !== emailAtual) {
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

    if (pic !== undefined && pic !== usuario.profile_pic) {
      updates.profile_pic = pic;
      alteracoes.push('foto de perfil');
    }

    if (description !== undefined && description !== usuario.description) {
      updates.description = description;
      alteracoes.push('descrição');
    }

    // 4. VERIFICAR SE HÁ ALTERAÇÕES
    
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


initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
  });
});