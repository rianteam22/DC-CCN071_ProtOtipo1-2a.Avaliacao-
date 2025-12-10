#!/bin/sh
# ============================================
# SGM - Script de Entrypoint
# Inicializacao automatica do container
# ============================================

set -e

echo "=========================================="
echo "SGM - Sistema de Gerenciamento Multimidia"
echo "=========================================="
echo ""

# Verificar variaveis de ambiente obrigatorias
check_required_vars() {
    echo "[1/5] Verificando variaveis de ambiente..."
    
    if [ -z "$JWT_SECRET" ]; then
        echo "ERRO: JWT_SECRET nao definido"
        exit 1
    fi
    
    if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
        echo "AVISO: Credenciais AWS nao definidas - uploads para S3 nao funcionarao"
    fi
    
    echo "    Variaveis OK"
}

# Verificar FFmpeg
check_ffmpeg() {
    echo "[2/5] Verificando FFmpeg..."
    
    if command -v ffmpeg > /dev/null 2>&1; then
        FFMPEG_VERSION=$(ffmpeg -version | head -n 1)
        echo "    $FFMPEG_VERSION"
    else
        echo "ERRO: FFmpeg nao encontrado"
        exit 1
    fi
    
    if command -v ffprobe > /dev/null 2>&1; then
        echo "    FFprobe OK"
    else
        echo "ERRO: FFprobe nao encontrado"
        exit 1
    fi
}

# Aguardar banco de dados
wait_for_database() {
    echo "[3/5] Aguardando banco de dados..."
    
    if [ -n "$DB_HOST" ]; then
        # PostgreSQL
        MAX_RETRIES=30
        RETRY_COUNT=0
        
        while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
            if nc -z "$DB_HOST" "${DB_PORT:-5432}" 2>/dev/null; then
                echo "    PostgreSQL disponivel em $DB_HOST:${DB_PORT:-5432}"
                break
            fi
            
            RETRY_COUNT=$((RETRY_COUNT + 1))
            echo "    Aguardando PostgreSQL... tentativa $RETRY_COUNT/$MAX_RETRIES"
            sleep 2
        done
        
        if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
            echo "ERRO: Timeout aguardando PostgreSQL"
            exit 1
        fi
    else
        # SQLite
        echo "    Usando SQLite local"
        mkdir -p /app/database
    fi
}

# Inicializar banco se necessario
init_database() {
    echo "[4/5] Verificando banco de dados..."
    
    if [ "$AUTO_INIT_DB" = "true" ]; then
        echo "    Executando inicializacao do banco..."
        node script/initDB.js || echo "    Banco ja inicializado ou erro na inicializacao"
    else
        echo "    Inicializacao automatica desabilitada"
        echo "    Execute manualmente: docker-compose exec sgm-app node script/initDB.js"
    fi
}

# Criar diretorios necessarios
create_directories() {
    echo "[5/5] Criando diretorios..."
    
    mkdir -p /app/database
    mkdir -p /app/uploads
    mkdir -p /app/logs
    
    echo "    Diretorios criados"
}

# Executar verificacoes
check_required_vars
check_ffmpeg
wait_for_database
create_directories
init_database

echo ""
echo "=========================================="
echo "Iniciando aplicacao..."
echo "Ambiente: ${NODE_ENV:-development}"
echo "Porta: ${PORT:-3333}"
echo "=========================================="
echo ""

# Executar comando passado como argumento ou comando padrao
exec "$@"
