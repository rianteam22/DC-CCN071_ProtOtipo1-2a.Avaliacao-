const { Sequelize } = require('sequelize');
require('dotenv').config();

const NODE_ENV = process.env.NODE_ENV || 'development';
const DB_HOST = process.env.DB_HOST;

let sequelize;

// Se DB_HOST estiver definido, usar PostgreSQL (produção)
// Caso contrário, usar SQLite (desenvolvimento local)
if (DB_HOST) {
  console.log('📦 Configurando PostgreSQL (AWS RDS)...');
  
  sequelize = new Sequelize({
    dialect: 'postgres',
    host: DB_HOST,
    port: process.env.DB_PORT || 5432,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false // Necessário para AWS RDS
      }
    },
    logging: NODE_ENV === 'development' ? console.log : false,
    define: {
      timestamps: false,
      freezeTableName: true
    }
  });
  
} else {
  console.log('📦 Configurando SQLite (desenvolvimento local)...');
  
  const path = require('path');
  const dbPath = path.join(__dirname, '..', 'database', 'database.sqlite');
  
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: dbPath,
    logging: NODE_ENV === 'development' ? console.log : false,
    define: {
      timestamps: false,
      freezeTableName: true
    }
  });
}

module.exports = sequelize;
