const { Sequelize } = require('sequelize');
require('dotenv').config();

// Criar instância do Sequelize com PostgreSQL (AWS RDS)
const sequelize = new Sequelize({
  dialect: 'postgres',
  host: process.env.DB_HOST,
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
  logging: console.log, // debug: mostra as queries no console
  define: {
    timestamps: false, // desabilita createdAt/updatedAt automáticos
    freezeTableName: true
  }
});

module.exports = sequelize;
