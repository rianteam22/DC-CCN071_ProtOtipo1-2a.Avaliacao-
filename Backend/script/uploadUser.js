const fs = require('fs');
const path = require('path');
// criar pasta do usuário para uploads
async function makeDirUsers(uuid){
  try {
    const userPath = path.resolve(__dirname, '..', 'uploads', uuid);
    if (!fs.existsSync(userPath)) {
      fs.mkdirSync(userPath, { recursive: true });
      console.log('Pasta do usuario criada');
    }
  } catch (error) {
    console.error('Erro ao criar pasta do usuário:', error);
  }
}

module.exports = { makeDirUsers };