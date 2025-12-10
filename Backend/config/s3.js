const { S3Client } = require('@aws-sdk/client-s3');
require('dotenv').config();

// Debug das credenciais sem expor valores completos
console.log('=== Configuracao AWS S3 ===');
console.log('AWS_REGION:', process.env.AWS_REGION || 'NAO DEFINIDA');
console.log('AWS_BUCKET_NAME:', process.env.AWS_BUCKET_NAME || 'NAO DEFINIDO');
console.log('AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID ? 
  process.env.AWS_ACCESS_KEY_ID.substring(0, 8) + '...' : 'NAO DEFINIDA');
console.log('AWS_SECRET_ACCESS_KEY:', process.env.AWS_SECRET_ACCESS_KEY ? 
  'Definida (' + process.env.AWS_SECRET_ACCESS_KEY.length + ' caracteres)' : 'NAO DEFINIDA');

// Verificar se as credenciais parecem validas
if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
  console.error('ERRO Credenciais AWS nao definidas no arquivo .env');
}

// Verificar caracteres especiais que podem causar problemas
const secretKey = process.env.AWS_SECRET_ACCESS_KEY || '';
if (secretKey.includes(' ') || secretKey.startsWith(' ') || secretKey.endsWith(' ')) {
  console.warn('AVISO SECRET_KEY contem espacos que podem causar problemas');
}

// Configurar cliente S3 compartilhado
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

console.log('=== Cliente S3 configurado ===');

module.exports = s3Client;