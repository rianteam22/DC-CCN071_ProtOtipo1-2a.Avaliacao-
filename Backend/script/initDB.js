const sequelize = require('../config/database');
const User = require('../models/User');

async function initDatabase() {
  try {
    console.log('Iniciando conexão com o banco de dados PostgreSQL (AWS RDS)...');

    // Testar conexão
    await sequelize.authenticate();
    console.log('Conexão estabelecida com sucesso!');

    // Sincronizar modelos
    console.log('Sincronizando modelos...');
    await sequelize.sync({
      force: true,  // ⚠️ CUIDADO: Apaga e recria as tabelas
      alter: true
    });
    console.log('Tabelas criadas/sincronizadas com sucesso!');

    await defaultUser();

    // Comandos básicos de teste
    const userCount = await User.count();
    console.log(`Total de usuários no banco: ${userCount}`);
    console.log('Usuários existentes:');
    const users = await User.findAll();
    users.forEach(user => {
      console.log(user.toJSON());
    });
    console.log('\nBanco de dados PostgreSQL inicializado com sucesso!');

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
    console.log('#### Usuário padrão criado:', userDefault.toJSON());

  } catch (error) {
    console.error('Erro ao criar usuário padrão:', error);
  }
}

initDatabase();