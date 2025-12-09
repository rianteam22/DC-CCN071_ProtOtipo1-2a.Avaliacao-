const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static').path;
const { Upload } = require('@aws-sdk/lib-storage');
const { GetObjectCommand } = require('@aws-sdk/client-s3');
const s3Client = require('../config/s3');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Configurar caminhos do FFmpeg e FFprobe
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

// Constantes
const THUMBNAIL_SIZE = 150;
const THUMBNAIL_FORMAT = 'webp';
const THUMBNAIL_QUALITY = 80;
const VIDEO_TIMEOUT = 30000; // 30 segundos max para processar vídeo

/**
 * Helper: Download de arquivo do S3
 * @param {string} s3Url - URL completa do S3
 * @returns {Promise<Buffer>} - Buffer do arquivo
 */
async function downloadFromS3(s3Url) {
  try {
    // Extrair bucket e key do URL
    // Formato: https://bucket.s3.region.amazonaws.com/key
    const urlObj = new URL(s3Url);
    const bucket = process.env.AWS_BUCKET_NAME;
    const key = urlObj.pathname.substring(1); // Remove leading slash

    console.log(`Downloading from S3: ${key}`);

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key
    });

    const response = await s3Client.send(command);

    // Converter stream para buffer
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
 * @param {string} s3Url - URL do vídeo no S3
 * @returns {Promise<number>} - Duração em segundos
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
 * @param {string} s3Url - URL da imagem no S3
 * @returns {Promise<Buffer>} - Buffer da thumbnail em WebP
 */
async function generateImageThumbnail(s3Url) {
  try {
    console.log(`Gerando thumbnail de imagem...`);

    // Download da imagem
    const imageBuffer = await downloadFromS3(s3Url);

    // Processar com Sharp: redimensionar e converter para WebP
    const thumbnailBuffer = await sharp(imageBuffer)
      .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {
        fit: 'cover',  // Crop para preencher o quadrado
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
 * @param {string} s3Url - URL do vídeo no S3
 * @returns {Promise<Buffer>} - Buffer da thumbnail em WebP
 */
async function generateVideoThumbnail(s3Url) {
  return new Promise(async (resolve, reject) => {
    let tempFramePath = null;

    try {
      console.log(`Gerando thumbnail de vídeo...`);

      // Obter duração do vídeo
      const duration = await getVideoDuration(s3Url);
      console.log(`Duração do vídeo: ${duration}s`);

      // Calcular timestamp do frame (meio do vídeo)
      let timestamp = duration / 2;
      if (duration < 1) {
        timestamp = 0.5; // Vídeos muito curtos: pegar frame em 0.5s
      }

      // Criar arquivo temporário para o frame
      const tempDir = os.tmpdir();
      tempFramePath = path.join(tempDir, `thumb_${Date.now()}.jpg`);

      // Extrair frame com FFmpeg
      ffmpeg(s3Url)
        .seekInput(timestamp)
        .frames(1)
        .output(tempFramePath)
        .on('end', async () => {
          try {
            // Ler frame extraído
            const frameBuffer = fs.readFileSync(tempFramePath);

            // Processar com Sharp: redimensionar e converter para WebP
            const thumbnailBuffer = await sharp(frameBuffer)
              .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {
                fit: 'cover',
                position: 'center'
              })
              .webp({ quality: THUMBNAIL_QUALITY })
              .toBuffer();

            // Limpar arquivo temporário
            fs.unlinkSync(tempFramePath);

            console.log(`✓ Thumbnail de vídeo gerada: ${thumbnailBuffer.length} bytes`);
            resolve(thumbnailBuffer);

          } catch (processError) {
            // Limpar arquivo temporário em caso de erro
            if (tempFramePath && fs.existsSync(tempFramePath)) {
              fs.unlinkSync(tempFramePath);
            }
            reject(processError);
          }
        })
        .on('error', (err) => {
          // Limpar arquivo temporário em caso de erro
          if (tempFramePath && fs.existsSync(tempFramePath)) {
            fs.unlinkSync(tempFramePath);
          }
          reject(new Error(`Erro ao extrair frame do vídeo: ${err.message}`));
        })
        .run();

      // Timeout de segurança
      setTimeout(() => {
        if (tempFramePath && fs.existsSync(tempFramePath)) {
          fs.unlinkSync(tempFramePath);
        }
        reject(new Error('Timeout ao gerar thumbnail de vídeo (30s)'));
      }, VIDEO_TIMEOUT);

    } catch (error) {
      // Limpar arquivo temporário em caso de erro
      if (tempFramePath && fs.existsSync(tempFramePath)) {
        fs.unlinkSync(tempFramePath);
      }
      reject(error);
    }
  });
}

/**
 * Upload de thumbnail para S3
 * @param {Buffer} thumbnailBuffer - Buffer da thumbnail
 * @param {string} userUuid - UUID do usuário
 * @param {string} originalFilename - Nome do arquivo original
 * @returns {Promise<{url: string, key: string}>} - URL e chave S3
 */
async function uploadThumbnailToS3(thumbnailBuffer, userUuid, originalFilename) {
  try {
    // Gerar chave S3: uploads/{uuid}/thumbs/thumb_150_{timestamp}_{filename}.webp
    const timestamp = Date.now();
    const sanitizedFilename = originalFilename
      .replace(/\.[^/.]+$/, '') // Remove extensão
      .replace(/[^a-zA-Z0-9._-]/g, '_'); // Sanitize
    const key = `uploads/${userUuid}/thumbs/thumb_150_${timestamp}_${sanitizedFilename}.webp`;

    console.log(`Uploading thumbnail to S3: ${key}`);

    // Upload usando @aws-sdk/lib-storage para suporte a multipart
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

    // Construir URL público
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
 * @param {Object} params
 * @param {string} params.mediaType - 'image', 'video', ou 'audio'
 * @param {string} params.fileUrl - URL S3 do arquivo original
 * @param {string} params.userUuid - UUID do usuário
 * @param {string} params.filename - Nome do arquivo original
 * @param {Object} params.metadata - Metadata adicional (mimetype, size, etc)
 * @returns {Promise<{thumbnail_url: string|null, thumbnail_s3_key: string|null}>}
 */
async function generateThumbnail({ mediaType, fileUrl, userUuid, filename, metadata }) {
  try {
    console.log(`\n=== Gerando thumbnail para ${mediaType}: ${filename} ===`);

    // Áudio: não gerar thumbnail
    if (mediaType === 'audio') {
      console.log('Tipo áudio: sem thumbnail');
      return { thumbnail_url: null, thumbnail_s3_key: null };
    }

    let thumbnailBuffer;

    // Gerar thumbnail baseado no tipo
    if (mediaType === 'image') {
      thumbnailBuffer = await generateImageThumbnail(fileUrl);
    } else if (mediaType === 'video') {
      thumbnailBuffer = await generateVideoThumbnail(fileUrl);
    } else {
      throw new Error(`Tipo de mídia não suportado: ${mediaType}`);
    }

    // Upload da thumbnail para S3
    const { url, key } = await uploadThumbnailToS3(thumbnailBuffer, userUuid, filename);

    console.log(`=== Thumbnail completa ===\n`);

    return {
      thumbnail_url: url,
      thumbnail_s3_key: key
    };

  } catch (error) {
    console.error(`✗ Erro ao gerar thumbnail:`, error.message);
    // Não bloquear upload - retornar null em caso de erro
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
