# SGM - Sistema de Gerenciamento Multimidia
## Guia de Deployment com Docker

---

## Requisitos

- Docker 20.10+
- Docker Compose 2.0+
- Conta AWS com acesso ao S3
- (Opcional) Dominio e certificado SSL para producao

---

## Estrutura de Arquivos Docker

```
projeto/
├── Backend/
│   ├── index.js
│   ├── package.json
│   └── ...
├── FrontEnd/
│   ├── index.html
│   ├── index.js
│   └── index.css
├── Dockerfile
├── docker-compose.yml
├── .dockerignore
├── .env                 # Criar a partir do .env.docker
└── nginx/               # Opcional para producao
    └── nginx.conf
```

---

## Passo a Passo para Deploy

### 1. Preparar Ambiente

```bash
# Clonar ou copiar o projeto
cd seu-projeto

# Copiar arquivo de ambiente
cp .env.docker .env

# Editar com suas credenciais
nano .env
```

### 2. Configurar Variaveis de Ambiente

Edite o arquivo `.env` com valores reais:

```env
# IMPORTANTE - Alterar para producao
JWT_SECRET=gere_um_secret_seguro_com_32_ou_mais_caracteres
DB_PASSWORD=senha_forte_para_postgresql

# AWS S3 - suas credenciais
AWS_REGION=sa-east-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=sua_secret_key
AWS_BUCKET_NAME=seu-bucket
```

### 3. Build e Execucao

```bash
# Build da imagem
docker-compose build

# Iniciar em background
docker-compose up -d

# Ver logs em tempo real
docker-compose logs -f sgm-app

# Verificar status
docker-compose ps
```

### 4. Inicializar Banco de Dados

```bash
# Executar script de inicializacao do banco
docker-compose exec sgm-app node script/initDB.js
```

### 5. Verificar Health Check

```bash
curl http://localhost:3333/health
```

Resposta esperada:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.456,
  "database": "connected",
  "environment": "production"
}
```

---

## Comandos Uteis

```bash
# Parar todos os containers
docker-compose down

# Parar e remover volumes (CUIDADO - apaga dados)
docker-compose down -v

# Reiniciar aplicacao
docker-compose restart sgm-app

# Ver logs de um servico especifico
docker-compose logs -f sgm-postgres

# Acessar shell do container
docker-compose exec sgm-app sh

# Verificar uso de recursos
docker stats
```

---

## Configuracao do FFmpeg

O FFmpeg ja esta instalado na imagem Docker. Para verificar:

```bash
docker-compose exec sgm-app ffmpeg -version
docker-compose exec sgm-app ffprobe -version
```

O processamento de video usa FFmpeg para:
- Gerar thumbnails de videos
- Transcodificar para multiplas qualidades (1080p, 720p, 480p)
- Extrair metadados de audio e video

---

## Deploy na AWS EC2

### 1. Preparar Instancia EC2

```bash
# Conectar via SSH
ssh -i sua-chave.pem ec2-user@seu-ip

# Instalar Docker
sudo yum update -y
sudo yum install -y docker
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ec2-user

# Instalar Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Logout e login novamente para aplicar grupo docker
exit
```

### 2. Transferir Arquivos

```bash
# Do seu computador local
scp -i sua-chave.pem -r ./projeto ec2-user@seu-ip:~/sgm
```

### 3. Configurar Security Groups

Liberar portas no Security Group da EC2:
- **22** - SSH
- **80** - HTTP
- **443** - HTTPS (se usar SSL)
- **3333** - Aplicacao (ou usar Nginx como proxy)

### 4. Executar

```bash
ssh -i sua-chave.pem ec2-user@seu-ip
cd ~/sgm
docker-compose up -d
```

---

## Usando AWS RDS em vez do PostgreSQL local

Se preferir usar AWS RDS:

1. Crie uma instancia RDS PostgreSQL
2. Remova ou comente o servico `sgm-postgres` no docker-compose.yml
3. Atualize as variaveis no `.env`:

```env
DB_HOST=seu-rds.xxxxxx.sa-east-1.rds.amazonaws.com
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=sua-senha-rds
DB_NAME=sgm_database
```

---

## Nginx como Reverse Proxy (Producao)

Criar arquivo `nginx/nginx.conf`:

```nginx
events {
    worker_connections 1024;
}

http {
    upstream sgm_app {
        server sgm-app:3333;
    }

    server {
        listen 80;
        server_name seu-dominio.com;

        # Redirecionar para HTTPS
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl;
        server_name seu-dominio.com;

        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;

        client_max_body_size 100M;

        location / {
            proxy_pass http://sgm_app;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }
    }
}
```

Executar com perfil de producao:

```bash
docker-compose --profile production up -d
```

---

## Monitoramento e Logs

### Logs Centralizados

```bash
# Ver todos os logs
docker-compose logs

# Logs com timestamps
docker-compose logs -t

# Ultimas 100 linhas
docker-compose logs --tail=100 sgm-app
```

### Metricas de Recursos

```bash
# Estatisticas em tempo real
docker stats

# Inspecionar container
docker inspect sgm-app
```

---

## Troubleshooting

### Problema: Container nao inicia

```bash
# Ver logs de erro
docker-compose logs sgm-app

# Verificar se portas estao em uso
sudo netstat -tlnp | grep 3333
```

### Problema: Erro de conexao com banco

```bash
# Verificar se PostgreSQL esta rodando
docker-compose ps sgm-postgres

# Testar conexao
docker-compose exec sgm-postgres psql -U postgres -d sgm_database
```

### Problema: FFmpeg nao funciona

```bash
# Verificar instalacao
docker-compose exec sgm-app which ffmpeg
docker-compose exec sgm-app ffmpeg -version

# Testar processamento
docker-compose exec sgm-app ffprobe -v quiet -print_format json -show_format -show_streams /app/test-video.mp4
```

### Problema: Erro de permissao no S3

```bash
# Verificar variaveis de ambiente
docker-compose exec sgm-app env | grep AWS

# Testar conexao com S3
docker-compose exec sgm-app node test/testS3.js
```

---

## Backup e Restauracao

### Backup do PostgreSQL

```bash
# Criar backup
docker-compose exec sgm-postgres pg_dump -U postgres sgm_database > backup.sql

# Restaurar backup
cat backup.sql | docker-compose exec -T sgm-postgres psql -U postgres sgm_database
```

### Backup dos Volumes

```bash
# Listar volumes
docker volume ls

# Backup de volume
docker run --rm -v sgm_sgm-postgres-data:/data -v $(pwd):/backup alpine tar czf /backup/postgres-backup.tar.gz /data
```

---

## Escalonamento (Load Balancer)

Para escalonamento horizontal no AWS:

1. Use um **Application Load Balancer (ALB)**
2. Configure um **Auto Scaling Group** com a AMI da EC2
3. Use **AWS RDS** para banco de dados compartilhado
4. **AWS S3** ja e compartilhado entre instancias

O arquivo de sessao JWT e stateless, entao funciona bem com multiplas instancias.

---

## Checklist de Producao

- [ ] Alterar JWT_SECRET para valor seguro
- [ ] Configurar senha forte para PostgreSQL
- [ ] Configurar credenciais AWS reais
- [ ] Configurar bucket S3 com permissoes corretas
- [ ] Configurar HTTPS com certificado SSL
- [ ] Configurar backup automatico do banco
- [ ] Configurar monitoramento (CloudWatch, etc)
- [ ] Testar health check endpoint
- [ ] Configurar limites de recursos adequados
- [ ] Revisar Security Groups da AWS

---

## Suporte

Para problemas ou duvidas:

1. Verificar logs: `docker-compose logs -f`
2. Verificar health: `curl http://localhost:3333/health`
3. Verificar recursos: `docker stats`
