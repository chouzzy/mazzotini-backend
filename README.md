Guia de Configuração para o Backend Base
Este documento serve como um checklist passo a passo para configurar um novo projeto utilizando este template de backend.

Passo 0: Preparação Inicial
Antes de configurar os serviços externos, prepare o seu ambiente de desenvolvimento local.

Clonar o Repositório:

git clone <url_do_seu_backend_base> nome-do-novo-projeto
cd nome-do-novo-projeto

Instalar Dependências:

yarn install
# ou
npm install

Criar o Arquivo .env:
Copie o conteúdo do .env.example para um novo arquivo chamado .env. Deixaremos ele em branco por enquanto e vamos preenchê-lo à medida que configuramos os serviços.

Passo 1: Configuração do MongoDB Atlas
Vamos criar o banco de dados que armazenará os dados da aplicação.

Criar um Novo Projeto:

Acesse o MongoDB Atlas.

Crie um novo "Project" para o seu cliente (ex: "Projeto Mazzotini").

Criar um Cluster:

Dentro do projeto, clique em "Build a Database".

Escolha o plano gratuito M0 Free para começar.

Selecione um provedor de nuvem e uma região (pode manter os padrões).

Dê um nome ao cluster (ex: mazzotini-cluster) e clique em "Create".

Configurar o Acesso:

Usuário do Banco de Dados: No menu esquerdo, vá para Database Access. Crie um novo usuário e senha. Guarde essas credenciais.

Acesso de Rede: No menu esquerdo, vá para Network Access. Adicione o seu endereço de IP atual clicando em "Add IP Address" > "Allow Access From Anywhere" (para desenvolvimento) ou "Add Current IP Address". Lembre-se de adicionar o IP do seu servidor de produção aqui no futuro.

Obter a String de Conexão:

Volte para a visão geral do seu "Database".

Clique no botão "Connect".

Selecione a opção "Drivers".

Copie a Connection String fornecida. Ela será algo como mongodb+srv://<user>:<password>@<cluster>.mongodb.net/....

Anote para o .env: Guarde esta string. Vamos usá-la para preencher a variável DATABASE_URL no nosso arquivo .env.

Passo 2: Configuração do Auth0
Vamos criar um "prédio" de autenticação dedicado para o novo cliente.

Criar um Novo Tenant (Conta):

No seu painel do Auth0, clique no seu nome no canto superior direito e selecione "+ Create Tenant".

Dê um nome (ex: mazzotini-auth) e escolha uma região.

Isso criará uma conta do Auth0 completamente isolada para o seu cliente.

Criar a API:

Dentro do novo Tenant, vá para Applications > APIs.

Clique em "+ Create API".

Name: API do Sistema Mazzotini (exemplo).

Identifier (Audience): https://api.mazzotini.com (exemplo). Este é o seu AUTH0_AUDIENCE.

Deixe o algoritmo como RS256.

Clique em "Create".

Criar a Aplicação (Frontend):

Vá para Applications > Applications.

Crie uma nova aplicação do tipo "Single Page Web Application" para o site e uma do tipo "Native" para o app desktop, se houver.

Anote o Domain e o Client ID de cada uma. O Domain será o seu AUTH0_DOMAIN.

Anote para o .env: Guarde o AUTH0_DOMAIN e o AUTH0_AUDIENCE.

Passo 3: Configuração do Stripe (Opcional)
Se o projeto envolver pagamentos.

Criar Produtos e Preços:

No seu painel do Stripe, vá para a seção Produtos.

Crie um novo produto (ex: "Assinatura Mazzotini").

Adicione os preços recorrentes (mensal, anual) a este produto.

Obter as Chaves de API:

Vá para Desenvolvedores > Chaves de API.

Copie a Chave publicável (pk_...) e a Chave secreta (sk_...).

Configurar o Webhook:

Vá para Desenvolvedores > Webhooks.

Clique em "+ Adicionar um endpoint".

URL do endpoint: https://api.seu-projeto.com/webhooks/stripe (a URL do seu backend em produção).

Eventos para ouvir: Selecione os eventos necessários (checkout.session.completed, customer.subscription.updated, etc.).

Após criar, copie o Segredo de assinatura (whsec_...).

Anote para o .env: Guarde a STRIPE_SECRET_KEY e a STRIPE_WEBHOOK_SECRET.

Passo 4: Preencher o Arquivo .env
Agora, com todas as chaves em mãos, abra o arquivo .env na raiz do seu projeto de backend e preencha todas as variáveis que você coletou.

# .env

# --- Servidor ---
PORT=8080

# --- MongoDB ---
DATABASE_URL="mongodb+srv://seu_usuario:sua_senha@seu_cluster.mongodb.net/nome_do_banco?retryWrites=true&w=majority"

# --- Auth0 ---
AUTH0_DOMAIN="seu-tenant.us.auth0.com"
AUTH0_AUDIENCE="https://api.seu-projeto.com"

# --- Stripe ---
STRIPE_SECRET_KEY="sk_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

Depois de preencher e salvar, seu backend base estará 100% configurado e pronto para rodar!