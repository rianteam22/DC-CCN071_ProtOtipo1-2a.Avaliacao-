const sequelize = require('../config/database');
const User = require('../models/User');
const Media = require('../models/Media');
const Tag = require('../models/Tag');
const MediaTag = require('../models/MediaTag');

async function initDatabase() {
  try {
    console.log('Iniciando conexao com o banco de dados...');
    console.log(`   Dialect: ${sequelize.getDialect()}`);

    // Testar conexao
    await sequelize.authenticate();
    console.log('Conexao estabelecida com sucesso!');

    // Inicializar associacoes
    const models = { User, Media, Tag, MediaTag };
    Object.keys(models).forEach(modelName => {
      if (models[modelName].associate) {
        models[modelName].associate(models);
      }
    });
    console.log('Associacoes inicializadas com sucesso!');

    // Sincronizar modelos
    console.log('Sincronizando modelos...');
    await sequelize.sync({
      force: true  // CUIDADO Apaga e recria as tabelas
    });
    console.log('Tabelas criadas sincronizadas com sucesso!');

    // Criar usuario padrao
    const defaultUser = await createDefaultUser();

    // Criar tags de exemplo para o usuario padrao
    if (defaultUser) {
      await createDefaultTags(defaultUser.id);
    }

    // Estatisticas
    const userCount = await User.count();
    console.log(`\nTotal de usuarios no banco: ${userCount}`);

    const mediaCount = await Media.count();
    console.log(`Total de midias no banco: ${mediaCount}`);

    const tagCount = await Tag.count();
    console.log(`Total de tags no banco: ${tagCount}`);

    console.log('\nUsuarios existentes:');
    const users = await User.findAll();
    users.forEach(user => {
      console.log(`   - ${user.email} (${user.uuid})`);
    });

    console.log('\nTags existentes:');
    const tags = await Tag.findAll({ include: ['user'] });
    tags.forEach(tag => {
      console.log(`   - ${tag.name} (${tag.color}) - Usuario: ${tag.userId}`);
    });

    console.log('\n=== Campos do modelo Media ===');
    const mediaAttributes = Media.rawAttributes;
    Object.keys(mediaAttributes).forEach(attr => {
      console.log(`   - ${attr}: ${mediaAttributes[attr].type.key || mediaAttributes[attr].type}`);
    });

    console.log('\nBanco de dados inicializado com sucesso!');
    console.log('\nNovos campos para video:');
    console.log('   - video_versions: JSON com versoes 1080p 720p 480p');
    console.log('   - processing_status: pending processing completed failed');

  } catch (error) {
    console.error('Erro ao inicializar banco de dados:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

async function createDefaultUser() {
  try {
    const userDefault = await User.create({
      email: 'c@c.com',
      senha: '123456',
      name: 'Carlos',
      user: 'carlos'
    });
    console.log('\nUsuario padrao criado:');
    console.log(`   Email: ${userDefault.email}`);
    console.log(`   Senha: 123456`);
    console.log(`   UUID: ${userDefault.uuid}`);
    
    return userDefault;

  } catch (error) {
    console.error('Erro ao criar usuario padrao:', error);
    return null;
  }
}

async function createDefaultTags(userId) {
  try {
    const defaultTags = [
      { name: 'favoritos', color: '#EF4444', userId },
      { name: 'trabalho', color: '#3B82F6', userId },
      { name: 'pessoal', color: '#22C55E', userId },
      { name: 'ferias', color: '#F97316', userId },
      { name: 'familia', color: '#EC4899', userId },
      { name: 'musica', color: '#8B5CF6', userId },
      { name: 'natureza', color: '#14B8A6', userId },
      { name: 'eventos', color: '#EAB308', userId }
    ];

    const createdTags = await Tag.bulkCreate(defaultTags);
    console.log(`\n${createdTags.length} tags de exemplo criadas para o usuario`);
    
    return createdTags;

  } catch (error) {
    console.error('Erro ao criar tags padrao:', error);
    return [];
  }
}

initDatabase();
