// Utilitario para extracao de metadados de arquivos multimidia
// Suporta imagens com dados EXIF dimensoes e propriedades tecnicas

const sharp = require('sharp');
const https = require('https');
const http = require('http');

// Funcao auxiliar para download via URL publica
async function downloadFromS3(s3Url) {
  return new Promise((resolve, reject) => {
    try {
      console.log(`Baixando arquivo de: ${s3Url}`);
      
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
          console.log(`Download completo: ${buffer.length} bytes`);
          resolve(buffer);
        });
        
        response.on('error', (err) => {
          reject(new Error(`Erro ao baixar arquivo: ${err.message}`));
        });
        
      }).on('error', (err) => {
        reject(new Error(`Erro na requisicao: ${err.message}`));
      });
      
    } catch (error) {
      console.error('Erro ao baixar do S3:', error);
      reject(new Error(`Falha ao baixar arquivo: ${error.message}`));
    }
  });
}

// Formatar data EXIF para formato legivel
function formatExifDate(exifDate) {
  if (!exifDate) return null;
  
  // EXIF usa formato YYYY:MM:DD HH:MM:SS
  const parts = exifDate.split(' ');
  if (parts.length >= 1) {
    const datePart = parts[0].replace(/:/g, '-');
    const timePart = parts[1] || '00:00:00';
    return `${datePart}T${timePart}`;
  }
  return exifDate;
}

// Converter coordenadas GPS de graus minutos segundos para decimal
function convertGPSToDecimal(gpsData, ref) {
  if (!gpsData || !Array.isArray(gpsData) || gpsData.length < 3) return null;
  
  const degrees = gpsData[0];
  const minutes = gpsData[1];
  const seconds = gpsData[2];
  
  let decimal = degrees + (minutes / 60) + (seconds / 3600);
  
  // Sul e Oeste sao negativos
  if (ref === 'S' || ref === 'W') {
    decimal = -decimal;
  }
  
  return parseFloat(decimal.toFixed(6));
}

// Extrair metadados de imagem usando Sharp
async function extractImageMetadata(fileUrl) {
  try {
    console.log('Extraindo metadados da imagem...');
    
    // Baixar imagem do S3
    const imageBuffer = await downloadFromS3(fileUrl);
    
    // Obter metadados com Sharp
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    const stats = await image.stats();
    
    // Estrutura de metadados da imagem
    const imageMetadata = {
      // Dimensoes
      width: metadata.width || null,
      height: metadata.height || null,
      
      // Propriedades tecnicas
      format: metadata.format || null,
      space: metadata.space || null, // Espaco de cor RGB CMYK etc
      channels: metadata.channels || null,
      depth: metadata.depth || null, // Profundidade de bits
      density: metadata.density || null, // DPI
      hasAlpha: metadata.hasAlpha || false,
      orientation: metadata.orientation || null,
      
      // Estatisticas de cor
      isOpaque: stats.isOpaque,
      dominant: stats.dominant || null, // Cor dominante
      
      // Dados EXIF se disponiveis
      exif: null
    };
    
    // Tentar extrair dados EXIF
    if (metadata.exif) {
      try {
        const exifData = parseExifBuffer(metadata.exif);
        imageMetadata.exif = exifData;
      } catch (exifError) {
        console.log('Nao foi possivel extrair EXIF:', exifError.message);
      }
    }
    
    console.log(`Metadados extraidos: ${imageMetadata.width}x${imageMetadata.height} ${imageMetadata.format}`);
    
    return imageMetadata;
    
  } catch (error) {
    console.error('Erro ao extrair metadados da imagem:', error);
    return null;
  }
}

// Parser simples de buffer EXIF
function parseExifBuffer(exifBuffer) {
  if (!exifBuffer || exifBuffer.length === 0) return null;
  
  try {
    // O Sharp retorna o buffer EXIF bruto
    // Vamos usar uma abordagem simplificada para extrair os dados mais comuns
    const exifString = exifBuffer.toString('binary');
    
    const exifData = {
      // Dados da camera
      make: extractExifString(exifBuffer, 'Make'),
      model: extractExifString(exifBuffer, 'Model'),
      software: extractExifString(exifBuffer, 'Software'),
      
      // Data e hora
      dateTime: extractExifString(exifBuffer, 'DateTime'),
      dateTimeOriginal: extractExifString(exifBuffer, 'DateTimeOriginal'),
      
      // Configuracoes de captura
      exposureTime: null,
      fNumber: null,
      iso: null,
      focalLength: null,
      
      // GPS se disponivel
      gps: null
    };
    
    // Limpar valores nulos
    Object.keys(exifData).forEach(key => {
      if (exifData[key] === null || exifData[key] === undefined) {
        delete exifData[key];
      }
    });
    
    return Object.keys(exifData).length > 0 ? exifData : null;
    
  } catch (error) {
    console.log('Erro ao parsear EXIF:', error.message);
    return null;
  }
}

// Extrair string de um campo EXIF especifico
function extractExifString(buffer, fieldName) {
  try {
    const bufferStr = buffer.toString('binary');
    const fieldIndex = bufferStr.indexOf(fieldName);
    
    if (fieldIndex === -1) return null;
    
    // Procurar por uma string legivel apos o nome do campo
    const startSearch = fieldIndex + fieldName.length;
    let result = '';
    let foundStart = false;
    
    for (let i = startSearch; i < Math.min(startSearch + 100, buffer.length); i++) {
      const char = buffer[i];
      
      // Caracteres ASCII imprimiveis
      if (char >= 32 && char <= 126) {
        if (!foundStart && (char >= 65 || char >= 48 && char <= 57)) {
          foundStart = true;
        }
        if (foundStart) {
          result += String.fromCharCode(char);
        }
      } else if (foundStart && result.length > 0) {
        break;
      }
    }
    
    return result.trim() || null;
    
  } catch (error) {
    return null;
  }
}

// Extrair metadados de video usando FFprobe
async function extractVideoMetadata(fileUrl) {
  const ffmpeg = require('fluent-ffmpeg');
  
  return new Promise((resolve) => {
    ffmpeg.ffprobe(fileUrl, (err, metadata) => {
      if (err) {
        console.error('Erro ao extrair metadados do video:', err);
        resolve(null);
        return;
      }
      
      try {
        const format = metadata.format || {};
        const videoStream = metadata.streams.find(s => s.codec_type === 'video') || {};
        const audioStream = metadata.streams.find(s => s.codec_type === 'audio') || {};
        
        const videoMetadata = {
          // Informacoes gerais
          duration: parseFloat(format.duration) || null,
          bitrate: parseInt(format.bit_rate) || null,
          
          // Video
          width: videoStream.width || null,
          height: videoStream.height || null,
          videoCodec: videoStream.codec_name || null,
          frameRate: parseFrameRate(videoStream.r_frame_rate),
          videoBitrate: parseInt(videoStream.bit_rate) || null,
          
          // Audio
          audioCodec: audioStream.codec_name || null,
          audioChannels: audioStream.channels || null,
          audioSampleRate: parseInt(audioStream.sample_rate) || null,
          audioBitrate: parseInt(audioStream.bit_rate) || null
        };
        
        console.log(`Metadados do video: ${videoMetadata.width}x${videoMetadata.height} ${videoMetadata.duration}s`);
        resolve(videoMetadata);
        
      } catch (parseError) {
        console.error('Erro ao processar metadados do video:', parseError);
        resolve(null);
      }
    });
  });
}

// Converter frame rate de fracao para numero
function parseFrameRate(frameRateStr) {
  if (!frameRateStr) return null;
  
  const parts = frameRateStr.split('/');
  if (parts.length === 2) {
    const num = parseInt(parts[0]);
    const den = parseInt(parts[1]);
    if (den !== 0) {
      return parseFloat((num / den).toFixed(2));
    }
  }
  
  return parseFloat(frameRateStr) || null;
}

// Extrair metadados de audio usando FFprobe
async function extractAudioMetadata(fileUrl) {
  const ffmpeg = require('fluent-ffmpeg');
  
  return new Promise((resolve) => {
    ffmpeg.ffprobe(fileUrl, (err, metadata) => {
      if (err) {
        console.error('Erro ao extrair metadados do audio:', err);
        resolve(null);
        return;
      }
      
      try {
        const format = metadata.format || {};
        const audioStream = metadata.streams.find(s => s.codec_type === 'audio') || {};
        
        const audioMetadata = {
          // Informacoes gerais
          duration: parseFloat(format.duration) || null,
          bitrate: parseInt(format.bit_rate) || null,
          
          // Audio
          codec: audioStream.codec_name || null,
          channels: audioStream.channels || null,
          sampleRate: parseInt(audioStream.sample_rate) || null,
          
          // Tags se disponiveis
          title: format.tags?.title || null,
          artist: format.tags?.artist || null,
          album: format.tags?.album || null,
          genre: format.tags?.genre || null,
          year: format.tags?.date || format.tags?.year || null
        };
        
        // Limpar valores nulos
        Object.keys(audioMetadata).forEach(key => {
          if (audioMetadata[key] === null) {
            delete audioMetadata[key];
          }
        });
        
        console.log(`Metadados do audio: ${audioMetadata.duration}s ${audioMetadata.bitrate}bps`);
        resolve(audioMetadata);
        
      } catch (parseError) {
        console.error('Erro ao processar metadados do audio:', parseError);
        resolve(null);
      }
    });
  });
}

// Funcao principal para extrair metadados baseado no tipo
async function extractMetadata(mediaType, fileUrl) {
  console.log(`\n=== Extraindo metadados para ${mediaType} ===`);
  
  try {
    switch (mediaType) {
      case 'image':
        return await extractImageMetadata(fileUrl);
      case 'video':
        return await extractVideoMetadata(fileUrl);
      case 'audio':
        return await extractAudioMetadata(fileUrl);
      default:
        console.log(`Tipo de midia nao suportado para extracao: ${mediaType}`);
        return null;
    }
  } catch (error) {
    console.error(`Erro na extracao de metadados:`, error.message);
    return null;
  }
}

module.exports = {
  extractMetadata,
  extractImageMetadata,
  extractVideoMetadata,
  extractAudioMetadata,
  downloadFromS3
};