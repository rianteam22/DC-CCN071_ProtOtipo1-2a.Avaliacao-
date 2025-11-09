// scripts/initDatabase.js
const sequelize = require('../config/database');
const User = require('../models/User');
const fs = require('fs');
const path = require('path');

async function initDatabase() {
  try {
    console.log('Iniciando conexão com o banco de dados...');
    
    // Testar conexão
    await sequelize.authenticate();
    console.log('Conexão estabelecida com sucesso!');
    
    // Sincronizar modelos (cria as tabelas)
    console.log('Sincronizando modelos...');
    await sequelize.sync({ 
      force: true, // false = não recria as tabelas existentes
      alter: true  // false = não altera estrutura de tabelas existentes
    });
    console.log('Tabelas criadas/sincronizadas com sucesso!');
    
    // Criar pasta uploads se não existir
    const uploadsPath = path.resolve(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadsPath)) {
      fs.mkdirSync(uploadsPath, { recursive: true });
      console.log('Pasta uploads/ criada');
    }

    await defaultUser();
    
    // Verificar se existem usuários
    const userCount = await User.count();
    console.log(`Total de usuários no banco: ${userCount}`);
    console.log('Usuários existentes:');
    const users = await User.findAll();
    users.forEach(user => {
      console.log(user.toJSON());
    });
    console.log('\nBanco de dados inicializado com sucesso!');
    console.log(`Arquivo do banco: ${sequelize.options.storage}`);
    
  } catch (error) {
    console.error('Erro ao inicializar banco de dados:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

async function defaultUser(){
  try {
    const userDefault = await User.create({
      email: 'c@c.com',
      senha: '123456'
    })
  } catch (error) {
    console.error('Erro ao criar usuário padrão:', error);
  }
}

initDatabase();