# ============================================
# SGM - Sistema de Gerenciamento Multimidia
# Dockerfile para Producao
# ============================================

# Usar Node.js 22 LTS com Alpine 3.21 versao mais segura e atualizada
# Verificar atualizacoes em https://hub.docker.com/_/node
FROM node:22-alpine3.21 AS builder

# Instalar dependencias de build necessarias para Sharp e outras libs nativas
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    gcc \
    libc-dev \
    linux-headers

# Diretorio de trabalho
WORKDIR /app

# Copiar arquivos de dependencias primeiro para aproveitar cache do Docker
COPY Backend/package*.json ./

# Instalar dependencias de producao
RUN npm ci --only=production

# ============================================
# Imagem de Producao
# ============================================
FROM node:22-alpine3.21

# Metadados da imagem
LABEL maintainer="SGM Team"
LABEL description="Sistema de Gerenciamento Multimidia"
LABEL version="1.0.0"

# Instalar FFmpeg FFprobe e outras dependencias de runtime
# FFmpeg e essencial para processamento de video e audio
RUN apk add --no-cache \
    ffmpeg \
    # Dependencias do Sharp para processamento de imagens
    vips-dev \
    fftw-dev \
    # Ferramentas uteis
    curl \
    # Timezone
    tzdata

# Configurar timezone para Sao Paulo
ENV TZ=America/Sao_Paulo

# Criar usuario nao root para seguranca
RUN addgroup -g 1001 -S nodejs && \
    adduser -S sgm -u 1001 -G nodejs

# Diretorio de trabalho
WORKDIR /app

# Copiar node_modules do builder
COPY --from=builder /app/node_modules ./node_modules

# Copiar codigo do Backend
COPY Backend/ ./

# Copiar Frontend para pasta que o Express vai servir
COPY FrontEnd/ ./FrontEnd/

# Criar diretorios necessarios
RUN mkdir -p /app/database /app/uploads /app/logs && \
    chown -R sgm:nodejs /app

# Mudar para usuario nao root
USER sgm

# Variaveis de ambiente padrao
ENV NODE_ENV=production
ENV PORT=3333

# Expor porta da aplicacao
EXPOSE 3333

# Health check para monitoramento
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3333/health || exit 1

# Comando para iniciar a aplicacao
CMD ["node", "index.js"]