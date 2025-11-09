// config/database.js
const { Sequelize } = require('sequelize');
const path = require('path');
const fs = require('fs');

// Caminho onde o arquivo do banco será criado
const databasePath = path.resolve(__dirname, '..', 'database');
    if (!fs.existsSync(databasePath)) {
      fs.mkdirSync(databasePath, { recursive: true });
      console.log('Pasta database/ criada');
    }
const dbPath = path.resolve(__dirname, '..','database', 'database.sqlite');

// Criar instância do Sequelize
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: dbPath, // onde o arquivo .sqlite será salvo
  logging: console.log, // mostra queries SQL no console (pode desabilitar com false)
  define: {
    timestamps: false, // desabilita createdAt/updatedAt automáticos
    freezeTableName: true // usa nome exato da tabela (não pluraliza)
  }
});

module.exports = sequelize;
