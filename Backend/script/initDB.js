const sequelize = require('../config/database');
const User = require('../models/User');
const Media = require('../models/Media');
const Tag = require('../models/Tag');
const MediaTag = require('../models/MediaTag');

async function initDatabase() {
  try {
    console.log('🔄 Iniciando conexão com o banco de dados...');
    console.log(`   Dialect: ${sequelize.getDialect()}`);

    // Testar conexão
    await sequelize.authenticate();
    console.log('✅ Conexão estabelecida com sucesso!');

    // Inicializar associações
    const models = { User, Media, Tag, MediaTag };
    Object.keys(models).forEach(modelName => {
      if (models[modelName].associate) {
        models[modelName].associate(models);
      }
    });
    console.log('✅ Associações inicializadas com sucesso!');

    // Sincronizar modelos
    console.log('🔄 Sincronizando modelos...');
    await sequelize.sync({
      force: true  // ⚠️ CUIDADO: Apaga e recria as tabelas
    });
    console.log('✅ Tabelas criadas/sincronizadas com sucesso!');

    // Criar usuário padrão
    const defaultUser = await createDefaultUser();

    // Criar tags de exemplo para o usuário padrão
    if (defaultUser) {
      await createDefaultTags(defaultUser.id);
    }

    // Estatísticas
    const userCount = await User.count();
    console.log(`\n📊 Total de usuários no banco: ${userCount}`);

    const mediaCount = await Media.count();
    console.log(`📊 Total de mídias no banco: ${mediaCount}`);

    const tagCount = await Tag.count();
    console.log(`📊 Total de tags no banco: ${tagCount}`);

    console.log('\n👥 Usuários existentes:');
    const users = await User.findAll();
    users.forEach(user => {
      console.log(`   - ${user.email} (${user.uuid})`);
    });

    console.log('\n🏷️  Tags existentes:');
    const tags = await Tag.findAll({ include: ['user'] });
    tags.forEach(tag => {
      console.log(`   - ${tag.name} (${tag.color}) - Usuário: ${tag.userId}`);
    });

    console.log('\n✅ Banco de dados inicializado com sucesso!');

  } catch (error) {
    console.error('❌ Erro ao inicializar banco de dados:', error);
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
    console.log('\n👤 Usuário padrão criado:');
    console.log(`   Email: ${userDefault.email}`);
    console.log(`   Senha: 123456`);
    console.log(`   UUID: ${userDefault.uuid}`);
    
    return userDefault;

  } catch (error) {
    console.error('❌ Erro ao criar usuário padrão:', error);
    return null;
  }
}

async function createDefaultTags(userId) {
  try {
    const defaultTags = [
      { name: 'favoritos', color: '#EF4444', userId },
      { name: 'trabalho', color: '#3B82F6', userId },
      { name: 'pessoal', color: '#22C55E', userId },
      { name: 'férias', color: '#F97316', userId },
      { name: 'família', color: '#EC4899', userId },
      { name: 'música', color: '#8B5CF6', userId },
      { name: 'natureza', color: '#14B8A6', userId },
      { name: 'eventos', color: '#EAB308', userId }
    ];

    const createdTags = await Tag.bulkCreate(defaultTags);
    console.log(`\n🏷️  ${createdTags.length} tags de exemplo criadas para o usuário`);
    
    return createdTags;

  } catch (error) {
    console.error('❌ Erro ao criar tags padrão:', error);
    return [];
  }
}

initDatabase();
