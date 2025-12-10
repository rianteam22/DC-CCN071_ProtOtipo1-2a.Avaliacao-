// testS3.js - Execute com node testS3.js na pasta Backend
require('dotenv').config();
const { S3Client, ListBucketsCommand, HeadBucketCommand } = require('@aws-sdk/client-s3');

console.log('\n========================================');
console.log('TESTE DE CREDENCIAIS AWS S3');
console.log('========================================\n');

// Mostrar configuracoes carregadas
console.log('Configuracoes do .env:');
console.log('  AWS_REGION:', process.env.AWS_REGION || 'NAO DEFINIDA');
console.log('  AWS_BUCKET_NAME:', process.env.AWS_BUCKET_NAME || 'NAO DEFINIDO');
console.log('  AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID || 'NAO DEFINIDA');
console.log('  AWS_SECRET_ACCESS_KEY:', process.env.AWS_SECRET_ACCESS_KEY ? 
  `${process.env.AWS_SECRET_ACCESS_KEY.length} caracteres` : 'NAO DEFINIDA');

// Verificar caracteres problematicos
const secretKey = process.env.AWS_SECRET_ACCESS_KEY || '';
console.log('\nVerificacao da SECRET_KEY:');
console.log('  Contem espacos:', secretKey.includes(' '));
console.log('  Comeca com espaco:', secretKey.startsWith(' '));
console.log('  Termina com espaco:', secretKey.endsWith(' '));
console.log('  Contem +:', secretKey.includes('+'));
console.log('  Contem /:', secretKey.includes('/'));
console.log('  Primeiros 5 chars:', secretKey.substring(0, 5));
console.log('  Ultimos 5 chars:', secretKey.substring(secretKey.length - 5));

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

async function test() {
  console.log('\n----------------------------------------');
  console.log('Teste 1: Listar buckets');
  console.log('----------------------------------------');
  
  try {
    const result = await s3.send(new ListBucketsCommand({}));
    console.log('SUCESSO! Buckets encontrados:');
    result.Buckets.forEach(b => console.log('  -', b.Name));
  } catch (error) {
    console.log('ERRO:', error.name);
    console.log('Mensagem:', error.message);
  }

  console.log('\n----------------------------------------');
  console.log('Teste 2: Verificar bucket especifico');
  console.log('----------------------------------------');
  
  try {
    await s3.send(new HeadBucketCommand({ Bucket: process.env.AWS_BUCKET_NAME }));
    console.log('SUCESSO! Bucket', process.env.AWS_BUCKET_NAME, 'existe e esta acessivel');
  } catch (error) {
    console.log('ERRO:', error.name);
    console.log('Mensagem:', error.message);
  }
  
  console.log('\n========================================\n');
}

test();
