// testUpload.js - Teste de upload direto para S3
require('dotenv').config();
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

console.log('\n========================================');
console.log('TESTE DE UPLOAD AWS S3');
console.log('========================================\n');

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

async function testUpload() {
  const testKey = `test-upload-${Date.now()}.txt`;
  const testContent = 'Teste de upload - pode deletar este arquivo';
  
  console.log('Bucket:', process.env.AWS_BUCKET_NAME);
  console.log('Arquivo de teste:', testKey);
  
  console.log('\n----------------------------------------');
  console.log('Teste: PutObject (upload)');
  console.log('----------------------------------------');
  
  try {
    const uploadParams = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: testKey,
      Body: testContent,
      ContentType: 'text/plain'
    };
    
    const result = await s3.send(new PutObjectCommand(uploadParams));
    console.log('SUCESSO! Arquivo enviado');
    console.log('ETag:', result.ETag);
    
    // Tentar deletar o arquivo de teste
    console.log('\nLimpando arquivo de teste...');
    await s3.send(new DeleteObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: testKey
    }));
    console.log('Arquivo de teste deletado');
    
  } catch (error) {
    console.log('ERRO:', error.name);
    console.log('Mensagem:', error.message);
    console.log('\n--- Detalhes do erro ---');
    console.log('Code:', error.Code || error.$metadata?.httpStatusCode);
    
    if (error.name === 'SignatureDoesNotMatch') {
      console.log('\nPossíveis causas:');
      console.log('1. Verifique se o relogio do sistema esta sincronizado');
      console.log('2. A SECRET_KEY pode ter caracteres especiais mal interpretados');
      console.log('3. Tente regenerar as credenciais no AWS IAM');
    }
    
    if (error.name === 'AccessDenied') {
      console.log('\nO usuario IAM nao tem permissao s3:PutObject');
      console.log('Adicione esta permissao na politica do IAM');
    }
  }
  
  console.log('\n========================================\n');
}

testUpload();
