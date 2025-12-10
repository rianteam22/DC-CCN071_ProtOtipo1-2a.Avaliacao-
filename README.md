# AWS S3 Drives - Sistema de Gerenciamento Multimídia (SGM)

Aplicação web completa para gerenciamento de objetos multimídia (imagens, áudios e vídeos) com armazenamento em nuvem AWS S3.

## Sobre o Projeto

Este projeto foi desenvolvido como parte da disciplina DC-CCN071 e implementa uma aplicação web full-stack com foco em gerenciamento de mídia, autenticação de usuários e infraestrutura em nuvem. A aplicação permite registro, login, edição de perfil, upload de mídias com processamento automático (thumbnails, transcodificação de vídeo, extração de metadados) e categorização por tags.

## Funcionalidades

### Autenticação e Autorização
- Registro de novos usuários com validação de email único
- Login seguro com geração de tokens JWT
- Proteção de rotas privadas via middleware de autenticação
- Sistema de logout com limpeza de sessão local

### Gerenciamento de Perfil
- Edição completa de informações pessoais (nome, username, email)
- Upload de foto de perfil para AWS S3 com preview em tempo real
- Alteração de senha com validação de senha atual
- Campo de descrição pessoal (biografia)
- Visualização da data de criação da conta

### Gerenciamento de Mídias
- **Upload de arquivos** para AWS S3:
  - Imagens: JPEG, PNG, GIF, WebP, SVG (até 5MB)
  - Vídeos: MP4, MOV, AVI, WebM, MKV (até 100MB)
  - Áudios: MP3, WAV, OGG, M4A, AAC, FLAC (até 20MB)
- **Geração automática de thumbnails** (150x150px WebP) para imagens e vídeos
- **Extração de metadados**:
  - Imagens: dimensões, formato, espaço de cor, dados EXIF (câmera, GPS, etc)
  - Vídeos: resolução, duração, codec, bitrate, frame rate
  - Áudios: duração, bitrate, sample rate, canais, tags ID3
- **Transcodificação de vídeos** em múltiplas qualidades (1080p, 720p, 480p)
- Edição de título e descrição
- Soft delete (lixeira) e hard delete (permanente)

### Sistema de Tags
- Criação de tags personalizadas com cores
- Associação de múltiplas tags por mídia
- Filtragem de mídias por tags
- Contador de mídias por tag

### Busca e Filtros
- Pesquisa por nome, título ou descrição
- Filtro por tipo de mídia (imagem, vídeo, áudio)
- Filtro por tag
- Ordenação por data, tamanho ou nome
- Paginação de resultados

### Player de Vídeo
- Seletor de qualidade (1080p, 720p, 480p, original)
- Indicador de status de processamento
- Opção de reprocessar vídeos com falha

## Stack Tecnológica

### Backend
| Tecnologia | Versão | Descrição |
|------------|--------|-----------|
| Node.js | 20.x | Runtime JavaScript |
| Express.js | 5.1.0 | Framework web |
| Sequelize | 6.37.7 | ORM para banco de dados |
| SQLite3 | 5.1.7 | Banco de dados (desenvolvimento) |
| PostgreSQL | 8.16.3 | Banco de dados (produção via AWS RDS) |
| JWT | 9.0.2 | Autenticação via tokens |
| bcrypt | 6.0.0 | Hash de senhas |
| Multer | 2.0.2 | Upload de arquivos |
| AWS SDK v3 | 3.947.0 | Integração com S3 |
| Sharp | 0.34.5 | Processamento de imagens |
| Fluent-FFmpeg | 2.1.3 | Processamento de vídeo/áudio |

### Frontend
| Tecnologia | Descrição |
|------------|-----------|
| HTML5 | Estrutura semântica |
| CSS3 | Design system com variáveis CSS |
| JavaScript ES6+ | Lógica da aplicação (Vanilla) |
| Dark Mode | Suporte automático via media query |
| SPA | Single Page Application |

### Infraestrutura AWS
| Serviço | Função |
|---------|--------|
| EC2 | Hospedagem da aplicação |
| RDS | Banco de dados PostgreSQL |
| S3 | Armazenamento de arquivos |
| VPC | Rede virtual isolada |
| IAM | Gerenciamento de credenciais |

### Ferramentas de Deploy
| Ferramenta | Função |
|------------|--------|
| Nginx | Reverse proxy |
| PM2 | Gerenciador de processos |

## Estrutura do Projeto

```
DC-CCN071_ProtOtipo1-2a.Avaliacao-
├── Backend
│   ├── config
│   │   ├── database.js         # Configuração SQLite/PostgreSQL
│   │   ├── mediaUpload.js      # Configuração upload de mídias
│   │   ├── s3.js               # Cliente AWS S3
│   │   └── upload.js           # Configuração upload de perfil
│   ├── controllers
│   │   ├── mediaController.js  # Lógica de mídias
│   │   └── tagController.js    # Lógica de tags
│   ├── database
│   │   └── database.sqlite     # Banco SQLite (dev)
│   ├── models
│   │   ├── Media.js            # Model de mídia
│   │   ├── MediaTag.js         # Model de associação mídia-tag
│   │   ├── Tag.js              # Model de tag
│   │   └── User.js             # Model de usuário
│   ├── routes
│   │   ├── mediaRoutes.js      # Rotas de mídia
│   │   └── tagRoutes.js        # Rotas de tags
│   ├── script
│   │   ├── initDB.js           # Script de inicialização do banco
│   │   └── uploadUser.js       # Utilitário para uploads
│   ├── test
│   │   ├── testS3.js           # Teste de credenciais S3
│   │   └── testUpload.js       # Teste de upload S3
│   ├── utils
│   │   ├── metadataExtractor.js    # Extração de metadados
│   │   ├── thumbnailGenerator.js   # Geração de thumbnails
│   │   └── videoTranscoder.js      # Transcodificação de vídeos
│   ├── .env                    # Variáveis de ambiente
│   ├── .env.example            # Exemplo de configuração
│   ├── index.js                # Servidor Express principal
│   └── package.json            # Dependências do projeto
│
├── FrontEnd
│   ├── index.css               # Estilos e design system
│   ├── index.html              # Estrutura HTML (SPA)
│   └── index.js                # Lógica de frontend
│
├── imgs
│   └── Misc.jpg                # Diagrama de arquitetura
│
├── .gitignore
└── README.md
```

## Instalação e Uso

### Pré-requisitos

- Node.js 18.x ou superior
- npm ou yarn
- Git
- FFmpeg (para processamento de vídeo/áudio)
- Conta AWS com bucket S3 configurado

### Configuração do Ambiente

1. **Clone o repositório:**
```bash
git clone https://github.com/rianteam22/DC-CCN071_ProtOtipo1-2a.Avaliacao-.git
cd DC-CCN071_ProtOtipo1-2a.Avaliacao-
```

2. **Instale as dependências:**
```bash
cd Backend
npm install
```

3. **Configure as variáveis de ambiente:**

Crie o arquivo `.env` na pasta Backend baseado no `.env.example`:

```env
# Ambiente
NODE_ENV=development

# Servidor
PORT=3333

# JWT
JWT_SECRET=sua_chave_secreta_aqui
JWT_EXPIRES_IN=7d

# Banco de dados (deixe vazio para usar SQLite local)
# DB_HOST=seu-rds-endpoint.region.rds.amazonaws.com
# DB_PORT=5432
# DB_USER=postgres
# DB_PASSWORD=sua-senha
# DB_NAME=aws_S3_drives

# AWS S3
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=sua-access-key
AWS_SECRET_ACCESS_KEY=sua-secret-key
AWS_BUCKET_NAME=seu-bucket-name
```

4. **Inicialize o banco de dados:**
```bash
npm run init-db
```

5. **Inicie o servidor:**

Desenvolvimento:
```bash
npm run dev
```

Produção:
```bash
npm start
```

6. **Acesse a aplicação:**
```
http://localhost:3333
```

### Credenciais de Teste

Após executar `npm run init-db`, um usuário padrão é criado:

| Campo | Valor |
|-------|-------|
| Email | c@c.com |
| Senha | 123456 |

Tags de exemplo também são criadas automaticamente.

### Testando Conexão com S3

```bash
# Testar credenciais
node test/testS3.js

# Testar upload
node test/testUpload.js
```

## API Endpoints

### Autenticação

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| POST | `/register` | Registra novo usuário | Não |
| POST | `/login` | Autentica e retorna token JWT | Não |

**POST /register**
```json
{
  "email": "usuario@email.com",
  "senha": "senha123"
}
```

**POST /login**
```json
{
  "email": "usuario@email.com",
  "senha": "senha123"
}
```

---

### Perfil

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| GET | `/profile/me` | Retorna dados do usuário autenticado | Sim |
| GET | `/profile/photo/:uuid` | Retorna URL da foto de perfil | Não |
| POST | `/profile/upload-photo` | Upload de foto de perfil | Sim |
| PUT | `/profile/update` | Atualiza informações do perfil | Sim |

**PUT /profile/update**
```json
{
  "name": "Nome Completo",
  "user": "username",
  "description": "Minha bio",
  "novoEmail": "novo@email.com",
  "novaSenha": "novaSenha123",
  "senhaAtual": "senhaAtual123"
}
```

---

### Mídias

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| GET | `/api/media` | Lista mídias do usuário | Sim |
| POST | `/api/media/upload` | Upload de nova mídia | Sim |
| GET | `/api/media/:uuid` | Busca mídia específica | Sim |
| PUT | `/api/media/:uuid` | Atualiza título/descrição/tags | Sim |
| DELETE | `/api/media/:uuid` | Deleta mídia | Sim |
| GET | `/api/media/:uuid/tags` | Lista tags de uma mídia | Sim |
| GET | `/api/media/:uuid/stream` | URL de streaming (vídeos) | Sim |
| GET | `/api/media/:uuid/processing-status` | Status do processamento | Sim |
| POST | `/api/media/:uuid/reprocess` | Reprocessa vídeo | Sim |

**GET /api/media - Query Parameters**
| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| type | string | Filtro por tipo: `image`, `video`, `audio` |
| tag | string | UUID da tag para filtrar |
| search | string | Termo de busca |
| sortBy | string | Campo: `created_at`, `size`, `filename`, `title` |
| sortOrder | string | Direção: `ASC`, `DESC` |
| page | number | Página atual (padrão: 1) |
| limit | number | Itens por página (padrão: 20, máx: 100) |
| active | boolean | Filtrar por ativos (padrão: true) |

**POST /api/media/upload - FormData**
| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| media | File | Sim | Arquivo de mídia |
| title | string | Não | Título da mídia |
| description | string | Não | Descrição |
| tagUuids | JSON | Não | Array de UUIDs de tags |

**PUT /api/media/:uuid**
```json
{
  "title": "Novo título",
  "description": "Nova descrição",
  "tagUuids": ["uuid-tag-1", "uuid-tag-2"]
}
```

**DELETE /api/media/:uuid - Query Parameters**
| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| permanent | boolean | `true` para hard delete |

**GET /api/media/:uuid/stream - Query Parameters**
| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| quality | string | `1080p`, `720p`, `480p`, `original` |

---

### Tags

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| GET | `/api/tags` | Lista todas as tags do usuário | Sim |
| POST | `/api/tags` | Cria nova tag | Sim |
| PUT | `/api/tags/:uuid` | Atualiza tag | Sim |
| DELETE | `/api/tags/:uuid` | Deleta tag | Sim |
| POST | `/api/tags/:uuid/media/:mediaUuid` | Adiciona tag a mídia | Sim |
| DELETE | `/api/tags/:uuid/media/:mediaUuid` | Remove tag de mídia | Sim |

**POST /api/tags**
```json
{
  "name": "Nome da Tag",
  "color": "#3B82F6"
}
```

**PUT /api/tags/:uuid**
```json
{
  "name": "Novo Nome",
  "color": "#EF4444"
}
```

---

### Respostas de Erro

Todas as rotas podem retornar os seguintes erros:

| Status | Descrição |
|--------|-----------|
| 400 | Bad Request - Dados inválidos |
| 401 | Unauthorized - Token não fornecido ou inválido |
| 403 | Forbidden - Acesso negado ao recurso |
| 404 | Not Found - Recurso não encontrado |
| 500 | Internal Server Error - Erro no servidor |

```json
{
  "error": "Descrição do erro",
  "details": "Detalhes técnicos (quando disponível)"
}
```

## Modelo de Dados

### Tabela Users

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | INTEGER | Chave primária (auto-incremento) |
| uuid | UUID | Identificador único universal |
| email | STRING | Email do usuário (único) |
| senha | STRING | Hash da senha (bcrypt) |
| user | STRING | Username (único, opcional) |
| name | STRING | Nome completo (opcional) |
| profile_pic | STRING | URL da foto no S3 |
| description | TEXT | Biografia (max 500 chars) |
| timestamp_created | DATE | Data de criação |

### Tabela Media

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | INTEGER | Chave primária |
| uuid | UUID | Identificador único |
| type | ENUM | `image`, `video`, `audio` |
| url | STRING | URL pública no S3 |
| s3_key | STRING | Chave S3 para deleção |
| thumbnail_url | STRING | URL da thumbnail |
| thumbnail_s3_key | STRING | Chave S3 da thumbnail |
| video_versions | JSON | Versões transcodificadas |
| processing_status | ENUM | `pending`, `processing`, `completed`, `failed` |
| userId | INTEGER | FK para users |
| title | STRING | Título (max 255 chars) |
| description | TEXT | Descrição (max 1000 chars) |
| filename | STRING | Nome original do arquivo |
| size | INTEGER | Tamanho em bytes |
| mimetype | STRING | Tipo MIME |
| metadata | JSON | Metadados extraídos |
| active | BOOLEAN | Soft delete flag |
| created_at | DATE | Data de criação |
| updated_at | DATE | Data de atualização |

### Tabela Tags

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | INTEGER | Chave primária |
| uuid | UUID | Identificador único |
| name | STRING | Nome da tag (max 50 chars) |
| color | STRING | Cor hexadecimal (#RRGGBB) |
| userId | INTEGER | FK para users |
| created_at | DATE | Data de criação |

### Tabela MediaTags

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | INTEGER | Chave primária |
| mediaId | INTEGER | FK para media |
| tagId | INTEGER | FK para tags |
| created_at | DATE | Data de associação |

## Arquitetura da Infraestrutura AWS

A aplicação está hospedada em uma infraestrutura AWS configurada seguindo as melhores práticas de segurança e isolamento de rede:

![Diagrama de Arquitetura AWS](./imgs/Misc.jpg)

O diagrama acima ilustra a topologia completa da infraestrutura, incluindo:
- **Internet** conectada ao **Internet Gateway** para acesso público
- **VPC** isolada (vpc-topicos-eng-sofware) com CIDR 10.0.0.0/16 na região us-east-1
- **Route Table** configurada para direcionar tráfego entre Internet Gateway e a subnet
- **Public Subnet** (10.0.1.0/24) hospedando a instância EC2
- **Security Group** com regras de firewall (HTTP, HTTPS, SSH)
- **Network ACL** provendo segurança adicional no nível da subnet
- **Instância EC2** executando Ubuntu Server com IP privado 10.0.1.96
- **Stack de aplicação**: Nginx (porta 80) → PM2 → Node.js Express (porta 3333)
- **AWS RDS** (PostgreSQL) para banco de dados em produção
- **AWS S3** para armazenamento de arquivos de mídia

## Segurança

- **Senhas:** Hash com bcrypt (10 salt rounds)
- **Autenticação:** JWT com expiração configurável
- **Validações:** Email e username únicos, senha mínima de 6 caracteres
- **Upload:** Validação de tipo MIME e extensão, limites de tamanho por tipo
- **Rotas Protegidas:** Middleware de autenticação JWT
- **Isolamento:** Cada usuário só acessa suas próprias mídias e tags
- **CORS:** Configurado para aceitar requisições do frontend
- **S3:** Bucket com políticas de acesso apropriadas

## Deploy na AWS

### 1. Configuração da VPC e Rede
- Criar VPC com CIDR apropriado
- Configurar subnet pública
- Anexar Internet Gateway
- Configurar tabela de rotas

### 2. Configuração do RDS (PostgreSQL)
- Criar instância RDS PostgreSQL
- Configurar Security Group para aceitar conexões da EC2
- Anotar endpoint para uso no .env

### 3. Configuração do S3
- Criar bucket com nome único
- Configurar políticas de acesso público para leitura
- Criar usuário IAM com permissões S3
- Gerar Access Key e Secret Key

### 4. Configuração da Instância EC2
```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Instalar FFmpeg
sudo apt install -y ffmpeg

# Instalar PM2
sudo npm install -g pm2

# Instalar Nginx
sudo apt install -y nginx
```

### 5. Deploy da Aplicação
```bash
# Clonar repositório
git clone https://github.com/rianteam22/DC-CCN071_ProtOtipo1-2a.Avaliacao-.git
cd DC-CCN071_ProtOtipo1-2a.Avaliacao-/Backend

# Instalar dependências
npm install

# Configurar variáveis de ambiente
nano .env

# Inicializar banco
npm run init-db

# Iniciar com PM2
pm2 start index.js --name aws-app
pm2 save
pm2 startup
```

### 6. Configurar Nginx
```nginx
server {
    listen 80;
    server_name _;

    client_max_body_size 100M;

    location / {
        proxy_pass http://localhost:3333;
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
```

```bash
sudo nano /etc/nginx/sites-available/aws-app
sudo ln -s /etc/nginx/sites-available/aws-app /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## Equipe e Colaboração

Este projeto foi desenvolvido colaborativamente com as seguintes contribuições:

- **Infraestrutura AWS:** Configuração de VPC, EC2, RDS, S3, Security Groups e Network ACLs (Rian)
- **Backend:** Desenvolvimento da API REST, autenticação JWT e integração com banco de dados (Carlos)
- **Frontend:** Interface de usuário, design system e integração com API (Carlos)
- **Deploy:** Configuração de Nginx, PM2 e ambiente de produção (Rian)
- **Documentação:** README, diagramas e especificações técnicas (Ambos)

## Licença

Este projeto foi desenvolvido para fins acadêmicos como parte da disciplina DC-CCN071.

## Contato

Repositório: [https://github.com/rianteam22/DC-CCN071_ProtOtipo1-2a.Avaliacao-](https://github.com/rianteam22/DC-CCN071_ProtOtipo1-2a.Avaliacao-)

---