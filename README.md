# DC-CCN071_ProtOtipo1-2a.Avaliacao-

O 1o. protótipo da aplicação deverá ter as seguintes características:
A. Funcionalidades básicas da aplicação web

1. Controle de autenticação e autorização (Login/Logout)
Objetivo:

- Garantir que apenas usuários autorizados acessem a aplicação.
- Proteger dados sensíveis e garantir a integridade da aplicação.
O sistema deve permitir que os usuários se registrem e novo usuários sejam criados.

2. Exibir dashboard para usuário autenticado

- Após o usuário autenticado, a aplicação deve exibir um dashboard simplificado, por exemplo: um menu de opções e acesso a edição do perfil do usuário (editar informações, alterar senha).
Propriedades do usuário: Nome completo, username, password, email, imagem do perfil, descrição e data de criação do usuário.
B. Especificações técnicas do ambiente de nuvem que vai hospedar a aplicação web
O protótipo deverá ser implantado usando, pelo menos, os seguintes serviços da AWS:
- Criação de uma VPC para acomodar os serviços e instância(s) utilizadas
- Criação de uma instância EC2 para hospedar a aplicação web
- Configurações de grupos de segurança
- Configurações de tabela de rotas
- Definir um IP público para permitir acesso via Internet

3. Apresentação do protótipo e documentação do projeto
Criar pelo menos um repositório de código (GIT) para a aplicação Web. Lembre-se de fazer a devida documentação do projeto.

## TODO para Criação do Protótipo da Aplicação Web

### 1. Planejamento Inicial

- FrontEnd: Nodejs com React | python com Flask 
- BackEnd: Nodejs com Express | python com Flask
- Banco de Dados: sqlite
- [ ] Elaborar um diagrama de alto nível da arquitetura da aplicação.
- IAM -> chaves -> VPC -> EC2 -> SG -> Rota -> IP Público


### 2. Estruturação do Projeto

- [x] Criar repositório Git (GitHub/GitLab)
- [ ] Definir estrutura de diretórios do projeto
- [ ] Configurar controle de versão e arquivos `.gitignore`


### 3. Desenvolvimento das Funcionalidades Básicas

#### 3.1 Autenticação e Autorização

- [ ] Implementar tela de cadastro de novos usuários
- [ ] Implementar tela de login dos usuários
- [ ] Criar lógica de autenticação (geração e validação de tokens/sessões)
- [ ] Implementar lógica de logout
- [ ] Proteger rotas restritas para usuários autenticados


#### 3.2 Dashboard do Usuário

- [ ] Desenvolver página dashboard para usuário autenticado
- [ ] Criar menu simplificado de navegação
- [ ] Implementar edição de perfil do usuário
    - Nome completo
    - Username
    - E-mail
    - Senha (com opção de alteração)
    - Imagem do perfil (upload e exibição)
    - Descrição pessoal
    - Data de criação do usuário (apenas exibição)


### 4. Infraestrutura e Deploy na AWS

#### 4.1 Provisionamento de Ambiente

- [ ] Criar uma VPC exclusiva para o ambiente da aplicação
- [ ] Configurar sub-redes e tabela de rotas
- [ ] Criar grupos de segurança definindo regras de acesso (HTTP/HTTPS, SSH, etc.)
- [ ] Criar instância EC2 para hospedar a aplicação web
- [ ] Atribuir IP público à instância EC2 e garantir acesso externo
- [ ] Documentar configurações básicas do ambiente


#### 4.2 Deploy da Aplicação

- [ ] Instalar dependências da aplicação na EC2
- [ ] Fazer deploy do código na instância
- [ ] Configurar variáveis de ambiente
- [ ] Testar o funcionamento do sistema em ambiente de nuvem


### 5. Documentação e Apresentação

- [ ] Documentar o repositório (README detalhado: funcionalidades, rodar local/testar, estrutura básica, contato)
- [ ] Escrever tutorial ou passo a passo para deploy/reprodução do ambiente
- [ ] Preparar apresentação do protótipo (slides, demonstração, etc.)