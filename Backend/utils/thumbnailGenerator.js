const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const { Upload } = require('@aws-sdk/lib-storage');
const { GetObjectCommand } = require('@aws-sdk/client-s3');
const s3Client = require('../config/s3');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// Função para verificar se um comando existe no sistema
function commandExists(cmd) {
  try {
    execSync(`which ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Configurar caminhos do FFmpeg e FFprobe
function configureFfmpeg() {
  const systemFfmpeg = commandExists('ffmpeg');
  const systemFfprobe = commandExists('ffprobe');

  if (systemFfmpeg && systemFfprobe) {
    console.log('✓ Usando FFmpeg/FFprobe do sistema');
    return;
  }

  console.log('⚠ FFmpeg/FFprobe não encontrados no sistema, usando binários estáticos...');
  try {
    const ffmpegStatic = require('ffmpeg-static');
    const ffprobeStatic = require('ffprobe-static');
    
    if (ffmpegStatic) ffmpeg.setFfmpegPath(ffmpegStatic);
    if (ffprobeStatic && ffprobeStatic.path) ffmpeg.setFfprobePath(ffprobeStatic.path);
    
    console.log('✓ Binários estáticos configurados');
  } catch (err) {
    console.error('✗ Erro ao configurar binários estáticos:', err.message);
  }
}

// Inicializar configuração
configureFfmpeg();

// Constantes
const THUMBNAIL_SIZE = 150;
const THUMBNAIL_FORMAT = 'webp';
const THUMBNAIL_QUALITY = 80;
const VIDEO_TIMEOUT = 30000;

/**
 * Helper: Download de arquivo do S3
 */
async function downloadFromS3(s3Url) {
  try {
    const urlObj = new URL(s3Url);
    const bucket = process.env.AWS_BUCKET_NAME;
    const key = urlObj.pathname.substring(1);

    console.log(`Downloading from S3: ${key}`);

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key
    });

    const response = await s3Client.send(command);

    const chunks = [];
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }

    return Buffer.concat(chunks);
  } catch (error) {
    console.error('Erro ao baixar do S3:', error);
    throw new Error(`Falha ao baixar arquivo do S3: ${error.message}`);
  }
}

/**
 * Helper: Obter duração de vídeo
 */
function getVideoDuration(s3Url) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(s3Url, (err, metadata) => {
      if (err) {
        reject(new Error(`Erro ao obter duração do vídeo: ${err.message}`));
      } else {
        const duration = metadata.format.duration || 0;
        resolve(duration);
      }
    });
  });
}

/**
 * Gerar thumbnail de imagem
 */
async function generateImageThumbnail(s3Url) {
  try {
    console.log(`Gerando thumbnail de imagem...`);

    const imageBuffer = await downloadFromS3(s3Url);

    const thumbnailBuffer = await sharp(imageBuffer)
      .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {
        fit: 'cover',
        position: 'center'
      })
      .webp({ quality: THUMBNAIL_QUALITY })
      .toBuffer();

    console.log(`✓ Thumbnail de imagem gerada: ${thumbnailBuffer.length} bytes`);
    return thumbnailBuffer;

  } catch (error) {
    console.error('Erro ao gerar thumbnail de imagem:', error);
    throw error;
  }
}

/**
 * Gerar thumbnail de vídeo (frame do meio)
 */
async function generateVideoThumbnail(s3Url) {
  return new Promise(async (resolve, reject) => {
    let tempFramePath = null;

    try {
      console.log(`Gerando thumbnail de vídeo...`);

      const duration = await getVideoDuration(s3Url);
      console.log(`Duração do vídeo: ${duration}s`);

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

            console.log(`✓ Thumbnail de vídeo gerada: ${thumbnailBuffer.length} bytes`);
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
          reject(new Error(`Erro ao extrair frame do vídeo: ${err.message}`));
        })
        .run();

      setTimeout(() => {
        if (tempFramePath && fs.existsSync(tempFramePath)) {
          fs.unlinkSync(tempFramePath);
        }
        reject(new Error('Timeout ao gerar thumbnail de vídeo (30s)'));
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
 * Upload de thumbnail para S3
 */
async function uploadThumbnailToS3(thumbnailBuffer, userUuid, originalFilename) {
  try {
    const timestamp = Date.now();
    const sanitizedFilename = originalFilename
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `uploads/${userUuid}/thumbs/thumb_150_${timestamp}_${sanitizedFilename}.webp`;

    console.log(`Uploading thumbnail to S3: ${key}`);

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

    console.log(`✓ Thumbnail uploaded: ${url}`);

    return { url, key };

  } catch (error) {
    console.error('Erro ao fazer upload da thumbnail:', error);
    throw new Error(`Falha ao fazer upload da thumbnail: ${error.message}`);
  }
}

/**
 * Função principal: Gerar e fazer upload de thumbnail
 */
async function generateThumbnail({ mediaType, fileUrl, userUuid, filename, metadata }) {
  try {
    console.log(`\n=== Gerando thumbnail para ${mediaType}: ${filename} ===`);

    if (mediaType === 'audio') {
      console.log('Tipo áudio: sem thumbnail');
      return { thumbnail_url: null, thumbnail_s3_key: null };
    }

    let thumbnailBuffer;

    if (mediaType === 'image') {
      thumbnailBuffer = await generateImageThumbnail(fileUrl);
    } else if (mediaType === 'video') {
      thumbnailBuffer = await generateVideoThumbnail(fileUrl);
    } else {
      throw new Error(`Tipo de mídia não suportado: ${mediaType}`);
    }

    const { url, key } = await uploadThumbnailToS3(thumbnailBuffer, userUuid, filename);

    console.log(`=== Thumbnail completa ===\n`);

    return {
      thumbnail_url: url,
      thumbnail_s3_key: key
    };

  } catch (error) {
    console.error(`✗ Erro ao gerar thumbnail:`, error.message);
    return { thumbnail_url: null, thumbnail_s3_key: null };
  }
}

module.exports = {
  generateThumbnail,
  generateImageThumbnail,
  generateVideoThumbnail,
  uploadThumbnailToS3,
  downloadFromS3
};
