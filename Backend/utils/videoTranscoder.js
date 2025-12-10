// Servico de transcodificacao de video para multiplas qualidades
// Gera versoes em 1080p 720p e 480p usando FFmpeg

const ffmpeg = require('fluent-ffmpeg');
const { Upload } = require('@aws-sdk/lib-storage');
const s3Client = require('../config/s3');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const http = require('http');

// Configurar caminhos do FFmpeg
function configureFfmpeg() {
  try {
    const ffmpegStatic = require('ffmpeg-static');
    const ffprobeStatic = require('ffprobe-static');
    
    if (ffmpegStatic) ffmpeg.setFfmpegPath(ffmpegStatic);
    if (ffprobeStatic && ffprobeStatic.path) ffmpeg.setFfprobePath(ffprobeStatic.path);
    
    console.log('FFmpeg configurado para transcodificacao');
  } catch (err) {
    console.log('Usando FFmpeg do sistema para transcodificacao');
  }
}

configureFfmpeg();

// Definicao das qualidades de video
const VIDEO_QUALITIES = {
  '1080p': {
    width: 1920,
    height: 1080,
    videoBitrate: '5000k',
    audioBitrate: '192k',
    label: 'Full HD (1080p)'
  },
  '720p': {
    width: 1280,
    height: 720,
    videoBitrate: '2500k',
    audioBitrate: '128k',
    label: 'HD (720p)'
  },
  '480p': {
    width: 854,
    height: 480,
    videoBitrate: '1000k',
    audioBitrate: '96k',
    label: 'SD (480p)'
  }
};

// Timeout para transcodificacao em milissegundos
const TRANSCODE_TIMEOUT = 30 * 60 * 1000; // 30 minutos

// Download de arquivo via URL
async function downloadFromUrl(url, destPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(destPath);
    
    protocol.get(url, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        file.close();
        fs.unlinkSync(destPath);
        downloadFromUrl(response.headers.location, destPath).then(resolve).catch(reject);
        return;
      }
      
      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(destPath);
        reject(new Error(`Erro HTTP ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve(destPath);
      });
      
      file.on('error', (err) => {
        fs.unlinkSync(destPath);
        reject(err);
      });
    }).on('error', (err) => {
      fs.unlinkSync(destPath);
      reject(err);
    });
  });
}

// Obter informacoes do video original
async function getVideoInfo(videoPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        reject(new Error(`Erro ao obter info do video: ${err.message}`));
        return;
      }
      
      const videoStream = metadata.streams.find(s => s.codec_type === 'video');
      const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
      
      resolve({
        duration: parseFloat(metadata.format.duration) || 0,
        width: videoStream ? videoStream.width : 0,
        height: videoStream ? videoStream.height : 0,
        hasAudio: !!audioStream,
        bitrate: parseInt(metadata.format.bit_rate) || 0
      });
    });
  });
}

// Determinar quais qualidades gerar baseado na resolucao original
function getQualitiesToGenerate(originalWidth, originalHeight) {
  const qualities = [];
  
  // So gera qualidades menores ou iguais ao original
  if (originalHeight >= 1080 || originalWidth >= 1920) {
    qualities.push('1080p');
  }
  if (originalHeight >= 720 || originalWidth >= 1280) {
    qualities.push('720p');
  }
  if (originalHeight >= 480 || originalWidth >= 854) {
    qualities.push('480p');
  }
  
  // Se o video original for menor que 480p ainda gera 480p
  if (qualities.length === 0) {
    qualities.push('480p');
  }
  
  return qualities;
}

// Transcodificar video para uma qualidade especifica
async function transcodeToQuality(inputPath, outputPath, quality, videoInfo) {
  return new Promise((resolve, reject) => {
    const config = VIDEO_QUALITIES[quality];
    
    if (!config) {
      reject(new Error(`Qualidade invalida: ${quality}`));
      return;
    }
    
    console.log(`Iniciando transcodificacao para ${quality}...`);
    
    // Calcular dimensoes mantendo aspect ratio
    let targetWidth = config.width;
    let targetHeight = config.height;
    
    const aspectRatio = videoInfo.width / videoInfo.height;
    
    if (aspectRatio > (targetWidth / targetHeight)) {
      // Video mais largo - ajustar altura
      targetHeight = Math.round(targetWidth / aspectRatio);
    } else {
      // Video mais alto - ajustar largura
      targetWidth = Math.round(targetHeight * aspectRatio);
    }
    
    // Garantir dimensoes pares para codecs
    targetWidth = targetWidth % 2 === 0 ? targetWidth : targetWidth - 1;
    targetHeight = targetHeight % 2 === 0 ? targetHeight : targetHeight - 1;
    
    let command = ffmpeg(inputPath)
      .outputOptions([
        '-c:v libx264',
        '-preset medium',
        '-crf 23',
        `-b:v ${config.videoBitrate}`,
        `-maxrate ${config.videoBitrate}`,
        `-bufsize ${parseInt(config.videoBitrate) * 2}k`,
        `-vf scale=${targetWidth}:${targetHeight}`,
        '-c:a aac',
        `-b:a ${config.audioBitrate}`,
        '-movflags +faststart',
        '-y'
      ])
      .output(outputPath);
    
    // Se nao tem audio adicionar audio silencioso
    if (!videoInfo.hasAudio) {
      command = command.outputOptions(['-an']);
    }
    
    let progressTimeout;
    
    command
      .on('start', (cmdLine) => {
        console.log(`FFmpeg comando: ${cmdLine.substring(0, 200)}...`);
      })
      .on('progress', (progress) => {
        // Reset timeout a cada progresso
        if (progressTimeout) clearTimeout(progressTimeout);
        progressTimeout = setTimeout(() => {
          command.kill('SIGKILL');
          reject(new Error('Timeout na transcodificacao - sem progresso'));
        }, 5 * 60 * 1000); // 5 min sem progresso
        
        if (progress.percent) {
          console.log(`${quality}: ${Math.round(progress.percent)}% concluido`);
        }
      })
      .on('end', () => {
        if (progressTimeout) clearTimeout(progressTimeout);
        console.log(`Transcodificacao ${quality} concluida`);
        resolve({
          quality,
          path: outputPath,
          width: targetWidth,
          height: targetHeight
        });
      })
      .on('error', (err) => {
        if (progressTimeout) clearTimeout(progressTimeout);
        console.error(`Erro na transcodificacao ${quality}:`, err.message);
        reject(err);
      })
      .run();
    
    // Timeout global
    setTimeout(() => {
      command.kill('SIGKILL');
      reject(new Error(`Timeout global na transcodificacao ${quality}`));
    }, TRANSCODE_TIMEOUT);
  });
}

// Upload de arquivo transcodificado para S3
async function uploadTranscodedVideo(filePath, userUuid, originalFilename, quality) {
  const timestamp = Date.now();
  const sanitizedFilename = originalFilename
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_');
  
  const key = `uploads/${userUuid}/videos/transcoded/${quality}/${timestamp}_${sanitizedFilename}.mp4`;
  
  console.log(`Fazendo upload de ${quality} para S3: ${key}`);
  
  const fileStream = fs.createReadStream(filePath);
  const fileStats = fs.statSync(filePath);
  
  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
      Body: fileStream,
      ContentType: 'video/mp4'
    }
  });
  
  await upload.done();
  
  const region = process.env.AWS_REGION;
  const bucket = process.env.AWS_BUCKET_NAME;
  const url = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  
  console.log(`Upload ${quality} concluido: ${url}`);
  
  return {
    quality,
    url,
    s3_key: key,
    size: fileStats.size
  };
}

// Limpar arquivos temporarios
function cleanupTempFiles(files) {
  files.forEach(file => {
    try {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
        console.log(`Arquivo temporario removido: ${file}`);
      }
    } catch (err) {
      console.error(`Erro ao remover arquivo temporario: ${err.message}`);
    }
  });
}

// Funcao principal para processar video em multiplas qualidades
async function processVideoQualities({ videoUrl, userUuid, filename, mediaId }) {
  const tempDir = os.tmpdir();
  const timestamp = Date.now();
  const tempFiles = [];
  
  console.log(`\n=== Iniciando processamento de qualidades para: ${filename} ===`);
  
  try {
    // Download do video original
    const originalPath = path.join(tempDir, `original_${timestamp}_${filename}`);
    tempFiles.push(originalPath);
    
    console.log('Baixando video original...');
    await downloadFromUrl(videoUrl, originalPath);
    console.log('Download concluido');
    
    // Obter informacoes do video
    const videoInfo = await getVideoInfo(originalPath);
    console.log(`Video original: ${videoInfo.width}x${videoInfo.height}, duracao: ${videoInfo.duration}s`);
    
    // Determinar qualidades a gerar
    const qualitiesToGenerate = getQualitiesToGenerate(videoInfo.width, videoInfo.height);
    console.log(`Qualidades a gerar: ${qualitiesToGenerate.join(', ')}`);
    
    const versions = [];
    
    // Processar cada qualidade
    for (const quality of qualitiesToGenerate) {
      const outputPath = path.join(tempDir, `${quality}_${timestamp}_${filename.replace(/\.[^/.]+$/, '.mp4')}`);
      tempFiles.push(outputPath);
      
      try {
        // Transcodificar
        const transcodeResult = await transcodeToQuality(originalPath, outputPath, quality, videoInfo);
        
        // Upload para S3
        const uploadResult = await uploadTranscodedVideo(outputPath, userUuid, filename, quality);
        
        versions.push({
          quality,
          label: VIDEO_QUALITIES[quality].label,
          url: uploadResult.url,
          s3_key: uploadResult.s3_key,
          width: transcodeResult.width,
          height: transcodeResult.height,
          size: uploadResult.size
        });
        
        console.log(`Versao ${quality} processada com sucesso`);
        
      } catch (qualityError) {
        console.error(`Erro ao processar ${quality}:`, qualityError.message);
        // Continua com as outras qualidades
      }
    }
    
    // Limpar arquivos temporarios
    cleanupTempFiles(tempFiles);
    
    console.log(`=== Processamento concluido: ${versions.length} versoes geradas ===\n`);
    
    return {
      success: true,
      originalResolution: `${videoInfo.width}x${videoInfo.height}`,
      duration: videoInfo.duration,
      versions
    };
    
  } catch (error) {
    console.error('Erro no processamento de qualidades:', error.message);
    cleanupTempFiles(tempFiles);
    
    return {
      success: false,
      error: error.message,
      versions: []
    };
  }
}

// Funcao para processar video em background de forma assincrona
async function processVideoQualitiesAsync(params, updateCallback) {
  // Executar processamento
  const result = await processVideoQualities(params);
  
  // Chamar callback para atualizar o banco de dados
  if (updateCallback && typeof updateCallback === 'function') {
    await updateCallback(result);
  }
  
  return result;
}

module.exports = {
  processVideoQualities,
  processVideoQualitiesAsync,
  getVideoInfo,
  VIDEO_QUALITIES,
  getQualitiesToGenerate
};
