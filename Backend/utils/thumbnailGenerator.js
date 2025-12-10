const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const { Upload } = require('@aws-sdk/lib-storage');
const s3Client = require('../config/s3');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const https = require('https');
const http = require('http');

// Funcao para verificar se um comando existe no sistema
function commandExists(cmd) {
  try {
    execSync(`which ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Configurar caminhos do FFmpeg e FFprobe (apenas sistema)
function configureFfmpeg() {
  const systemFfmpeg = commandExists('ffmpeg');
  const systemFfprobe = commandExists('ffprobe');

  console.log('=== Verificando FFmpeg/FFprobe ===');
  console.log('ffmpeg disponivel:', systemFfmpeg);
  console.log('ffprobe disponivel:', systemFfprobe);

  if (systemFfmpeg && systemFfprobe) {
    try {
      const ffmpegVersion = execSync('ffmpeg -version').toString().split('\n')[0];
      const ffprobeVersion = execSync('ffprobe -version').toString().split('\n')[0];
      console.log('ffmpeg:', ffmpegVersion);
      console.log('ffprobe:', ffprobeVersion);
    } catch (err) {
      console.log('Nao foi possivel obter versao:', err.message);
    }
    console.log('Usando FFmpeg/FFprobe do sistema');
    console.log('==================================');
    return;
  }

  console.log('==================================');
  throw new Error(
    'FFmpeg e FFprobe sao necessarios mas nao foram encontrados no sistema. ' +
    'Instale com: sudo apt install ffmpeg (Ubuntu/Debian) ou sudo dnf install ffmpeg (Fedora)'
  );
}

// Inicializar configuracao
configureFfmpeg();

// Constantes
const THUMBNAIL_SIZE = 150;
const THUMBNAIL_FORMAT = 'webp';
const THUMBNAIL_QUALITY = 80;
const VIDEO_TIMEOUT = 30000;

/**
 * Helper - Download de arquivo via URL publica em vez do AWS SDK
 */
async function downloadFromS3(s3Url) {
  return new Promise((resolve, reject) => {
    try {
      console.log(`Downloading from URL ${s3Url}`);
      
      const protocol = s3Url.startsWith('https') ? https : http;
      
      protocol.get(s3Url, (response) => {
        // Verificar se houve redirecionamento
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          downloadFromS3(response.headers.location).then(resolve).catch(reject);
          return;
        }
        
        // Verificar status de sucesso
        if (response.statusCode !== 200) {
          reject(new Error(`Erro HTTP ${response.statusCode} ao baixar arquivo`));
          return;
        }
        
        const chunks = [];
        
        response.on('data', (chunk) => {
          chunks.push(chunk);
        });
        
        response.on('end', () => {
          const buffer = Buffer.concat(chunks);
          console.log(`Download completo ${buffer.length} bytes`);
          resolve(buffer);
        });
        
        response.on('error', (err) => {
          reject(new Error(`Erro ao baixar arquivo ${err.message}`));
        });
        
      }).on('error', (err) => {
        reject(new Error(`Erro na requisicao ${err.message}`));
      });
      
    } catch (error) {
      console.error('Erro ao baixar do S3', error);
      reject(new Error(`Falha ao baixar arquivo ${error.message}`));
    }
  });
}

/**
 * Helper - Obter duracao de video
 */
function getVideoDuration(s3Url) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(s3Url, (err, metadata) => {
      if (err) {
        reject(new Error(`Erro ao obter duracao do video ${err.message}`));
      } else {
        const duration = metadata.format.duration || 0;
        resolve(duration);
      }
    });
  });
}

/**
 * Helper - Verificar se arquivo de audio tem imagem embutida (album art)
 */
function checkAudioHasEmbeddedImage(s3Url) {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(s3Url, (err, metadata) => {
      if (err) {
        console.log('Erro ao verificar imagem embutida no audio:', err.message);
        resolve(false);
        return;
      }
      
      // Procurar por stream de video que seria a imagem de capa
      const videoStream = metadata.streams.find(stream => 
        stream.codec_type === 'video' && 
        (stream.codec_name === 'mjpeg' || stream.codec_name === 'png' || stream.codec_name === 'bmp')
      );
      
      if (videoStream) {
        console.log(`Imagem embutida encontrada: ${videoStream.codec_name} ${videoStream.width}x${videoStream.height}`);
        resolve(true);
      } else {
        console.log('Nenhuma imagem embutida encontrada no audio');
        resolve(false);
      }
    });
  });
}

/**
 * Gerar thumbnail de imagem
 */
async function generateImageThumbnail(s3Url) {
  try {
    console.log(`Gerando thumbnail de imagem`);

    const imageBuffer = await downloadFromS3(s3Url);

    const thumbnailBuffer = await sharp(imageBuffer)
      .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {
        fit: 'cover',
        position: 'center'
      })
      .webp({ quality: THUMBNAIL_QUALITY })
      .toBuffer();

    console.log(`Thumbnail de imagem gerada ${thumbnailBuffer.length} bytes`);
    return thumbnailBuffer;

  } catch (error) {
    console.error('Erro ao gerar thumbnail de imagem', error);
    throw error;
  }
}

/**
 * Gerar thumbnail de video frame do meio
 */
async function generateVideoThumbnail(s3Url) {
  return new Promise(async (resolve, reject) => {
    let tempFramePath = null;

    try {
      console.log(`Gerando thumbnail de video`);

      const duration = await getVideoDuration(s3Url);
      console.log(`Duracao do video ${duration}s`);

      let timestamp = duration / 2;
      if (duration < 1) {
        timestamp = 0.5;
      }

      const tempDir = os.tmpdir();
      tempFramePath = path.join(tempDir, `thumb_${Date.now()}.jpg`);

      ffmpeg(s3Url)
        .seekInput(timestamp)
        .frames(1)
        .output(tempFramePath)
        .on('end', async () => {
          try {
            const frameBuffer = fs.readFileSync(tempFramePath);

            const thumbnailBuffer = await sharp(frameBuffer)
              .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {
                fit: 'cover',
                position: 'center'
              })
              .webp({ quality: THUMBNAIL_QUALITY })
              .toBuffer();

            fs.unlinkSync(tempFramePath);

            console.log(`Thumbnail de video gerada ${thumbnailBuffer.length} bytes`);
            resolve(thumbnailBuffer);

          } catch (processError) {
            if (tempFramePath && fs.existsSync(tempFramePath)) {
              fs.unlinkSync(tempFramePath);
            }
            reject(processError);
          }
        })
        .on('error', (err) => {
          if (tempFramePath && fs.existsSync(tempFramePath)) {
            fs.unlinkSync(tempFramePath);
          }
          reject(new Error(`Erro ao extrair frame do video ${err.message}`));
        })
        .run();

      setTimeout(() => {
        if (tempFramePath && fs.existsSync(tempFramePath)) {
          fs.unlinkSync(tempFramePath);
        }
        reject(new Error('Timeout ao gerar thumbnail de video 30s'));
      }, VIDEO_TIMEOUT);

    } catch (error) {
      if (tempFramePath && fs.existsSync(tempFramePath)) {
        fs.unlinkSync(tempFramePath);
      }
      reject(error);
    }
  });
}

/**
 * Gerar thumbnail de audio a partir da capa embutida (album art)
 * Retorna null se nao houver imagem embutida
 */
async function generateAudioThumbnail(s3Url) {
  return new Promise(async (resolve, reject) => {
    let tempCoverPath = null;

    try {
      console.log(`Verificando capa embutida no audio`);

      // Verificar se tem imagem embutida
      const hasImage = await checkAudioHasEmbeddedImage(s3Url);
      
      if (!hasImage) {
        console.log('Audio sem capa embutida');
        resolve(null);
        return;
      }

      const tempDir = os.tmpdir();
      tempCoverPath = path.join(tempDir, `audio_cover_${Date.now()}.jpg`);

      // Extrair a imagem embutida usando FFmpeg
      // -an remove audio -vcodec copy copia o stream de video que e a imagem
      ffmpeg(s3Url)
        .outputOptions(['-an', '-vcodec', 'copy'])
        .output(tempCoverPath)
        .on('end', async () => {
          try {
            // Verificar se o arquivo foi criado
            if (!fs.existsSync(tempCoverPath)) {
              console.log('Arquivo de capa nao foi criado');
              resolve(null);
              return;
            }

            const coverBuffer = fs.readFileSync(tempCoverPath);
            
            // Verificar se tem conteudo
            if (coverBuffer.length === 0) {
              console.log('Arquivo de capa esta vazio');
              fs.unlinkSync(tempCoverPath);
              resolve(null);
              return;
            }

            console.log(`Capa extraida com sucesso ${coverBuffer.length} bytes`);

            // Redimensionar para thumbnail
            const thumbnailBuffer = await sharp(coverBuffer)
              .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {
                fit: 'cover',
                position: 'center'
              })
              .webp({ quality: THUMBNAIL_QUALITY })
              .toBuffer();

            fs.unlinkSync(tempCoverPath);

            console.log(`Thumbnail de audio gerada ${thumbnailBuffer.length} bytes`);
            resolve(thumbnailBuffer);

          } catch (processError) {
            console.error('Erro ao processar capa do audio:', processError.message);
            if (tempCoverPath && fs.existsSync(tempCoverPath)) {
              fs.unlinkSync(tempCoverPath);
            }
            resolve(null);
          }
        })
        .on('error', (err) => {
          console.log('Erro ao extrair capa do audio:', err.message);
          if (tempCoverPath && fs.existsSync(tempCoverPath)) {
            fs.unlinkSync(tempCoverPath);
          }
          // Nao rejeita apenas resolve null pois audio sem capa e valido
          resolve(null);
        })
        .run();

      // Timeout de 15 segundos para extracao de capa
      setTimeout(() => {
        if (tempCoverPath && fs.existsSync(tempCoverPath)) {
          fs.unlinkSync(tempCoverPath);
        }
        resolve(null);
      }, 15000);

    } catch (error) {
      console.error('Erro ao gerar thumbnail de audio:', error.message);
      if (tempCoverPath && fs.existsSync(tempCoverPath)) {
        fs.unlinkSync(tempCoverPath);
      }
      resolve(null);
    }
  });
}

/**
 * Upload de thumbnail para S3
 */
async function uploadThumbnailToS3(thumbnailBuffer, userUuid, originalFilename) {
  try {
    const timestamp = Date.now();
    const sanitizedFilename = originalFilename
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `uploads/${userUuid}/thumbs/thumb_150_${timestamp}_${sanitizedFilename}.webp`;

    console.log(`Uploading thumbnail to S3 ${key}`);

    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: key,
        Body: thumbnailBuffer,
        ContentType: 'image/webp'
      }
    });

    const result = await upload.done();

    const region = process.env.AWS_REGION;
    const bucket = process.env.AWS_BUCKET_NAME;
    const url = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

    console.log(`Thumbnail uploaded ${url}`);

    return { url, key };

  } catch (error) {
    console.error('Erro ao fazer upload da thumbnail', error);
    throw new Error(`Falha ao fazer upload da thumbnail ${error.message}`);
  }
}

/**
 * Funcao principal - Gerar e fazer upload de thumbnail
 */
async function generateThumbnail({ mediaType, fileUrl, userUuid, filename, metadata }) {
  try {
    console.log(`\n=== Gerando thumbnail para ${mediaType} ${filename} ===`);

    let thumbnailBuffer = null;

    if (mediaType === 'image') {
      thumbnailBuffer = await generateImageThumbnail(fileUrl);
    } else if (mediaType === 'video') {
      thumbnailBuffer = await generateVideoThumbnail(fileUrl);
    } else if (mediaType === 'audio') {
      // Tentar extrair capa embutida do audio
      thumbnailBuffer = await generateAudioThumbnail(fileUrl);
      
      if (!thumbnailBuffer) {
        console.log('Audio sem capa embutida - sem thumbnail');
        return { thumbnail_url: null, thumbnail_s3_key: null };
      }
    } else {
      throw new Error(`Tipo de midia nao suportado ${mediaType}`);
    }

    if (!thumbnailBuffer) {
      return { thumbnail_url: null, thumbnail_s3_key: null };
    }

    const { url, key } = await uploadThumbnailToS3(thumbnailBuffer, userUuid, filename);

    console.log(`=== Thumbnail completa ===\n`);

    return {
      thumbnail_url: url,
      thumbnail_s3_key: key
    };

  } catch (error) {
    console.error(`Erro ao gerar thumbnail`, error.message);
    return { thumbnail_url: null, thumbnail_s3_key: null };
  }
}

module.exports = {
  generateThumbnail,
  generateImageThumbnail,
  generateVideoThumbnail,
  generateAudioThumbnail,
  uploadThumbnailToS3,
  downloadFromS3,
  checkAudioHasEmbeddedImage
};