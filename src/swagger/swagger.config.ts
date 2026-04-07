/**
 * Configuração central do Swagger (OpenAPI 3.0)
 *
 * O swagger-jsdoc lê os blocos JSDoc com @swagger nas rotas e gera o spec completo.
 * A UI interativa fica disponível em /api-docs quando o servidor está rodando.
 *
 * Para adicionar um novo endpoint à documentação:
 *  1. Vá ao arquivo de rota correspondente em src/routes/
 *  2. Adicione um bloco com @swagger acima do handler
 *  3. Reinicie o servidor — a UI atualiza automaticamente
 */

import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Mazzotini Platform API',
            version: '1.0.0',
            description: `
## API do sistema de gestão de ativos judiciais da Mazzotini Advogados

### Autenticação
Todos os endpoints (exceto \`POST /api/users\`) exigem um **Bearer Token JWT** emitido pelo Auth0.

Inclua o cabeçalho em cada requisição:
\`\`\`
Authorization: Bearer <token>
\`\`\`

### Níveis de Acesso (Roles)
| Role | Descrição |
|------|-----------|
| \`ADMIN\` | Acesso total — gerencia usuários, ativos e configurações |
| \`OPERATOR\` | Cria e edita ativos, sincroniza com o Legal One |
| \`INVESTOR\` | Visualiza seus próprios ativos e investimentos |
| \`ASSOCIATE\` | Visualiza ativos vinculados a sua carteira |

### Integração Legal One
O sistema sincroniza automaticamente andamentos e documentos via API do Legal One.
A "Malha Fina" descobre processos filhos (Recursos e Incidentes) automaticamente.
            `,
            contact: {
                name: 'Awer — Desenvolvimento',
                email: 'dev@awer.co',
            },
        },
        servers: [
            {
                url: 'http://localhost:8080',
                description: 'Ambiente de Desenvolvimento',
            },
            {
                url: 'https://mazzotini-backend-production.up.railway.app',
                description: 'Ambiente de Produção',
            },
        ],
        // ─── Esquema de Segurança ──────────────────────────────────────────────
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'Token JWT emitido pelo Auth0. Use o botão "Authorize" e cole o token sem o prefixo "Bearer".',
                },
            },
            // ─── Schemas Reutilizáveis ─────────────────────────────────────────
            schemas: {
                // --- Resposta de erro padrão ---
                ErrorResponse: {
                    type: 'object',
                    properties: {
                        error: { type: 'string', example: 'Recurso não encontrado.' },
                    },
                },
                // --- Ativo Judicial (resumo para listagens) ---
                CreditAssetSummary: {
                    type: 'object',
                    properties: {
                        id:               { type: 'string', example: '6643a1f...' },
                        legalOneId:       { type: 'integer', example: 7078 },
                        legalOneType:     { type: 'string', enum: ['Lawsuit', 'Appeal', 'ProceduralIssue'] },
                        processNumber:    { type: 'string', example: '1021601-47.1997.8.26.0100' },
                        nickname:         { type: 'string', nullable: true, example: 'Viscardi' },
                        originalCreditor: { type: 'string', example: 'Portus Capital Holding' },
                        origemProcesso:   { type: 'string', example: '1ª Vara Cível de SP' },
                        otherParty:       { type: 'string', example: 'INSS' },
                        originalValue:    { type: 'number', example: 450000 },
                        acquisitionValue: { type: 'number', example: 85000 },
                        currentValue:     { type: 'number', example: 97300.50 },
                        acquisitionDate:  { type: 'string', format: 'date-time' },
                        updateIndexType:  { type: 'string', example: 'IGPM' },
                        status:           { type: 'string', example: 'Ativo' },
                        folderId:         { type: 'string', nullable: true },
                        updateIndexType_: { type: 'string', nullable: true },
                        investments:      { type: 'array', items: { $ref: '#/components/schemas/InvestmentSummary' } },
                    },
                },
                // --- Investimento (resumo) ---
                InvestmentSummary: {
                    type: 'object',
                    properties: {
                        id:             { type: 'string' },
                        investorShare:  { type: 'number', example: 30 },
                        mazzotiniShare: { type: 'number', example: 5 },
                        userId:         { type: 'string' },
                        creditAssetId:  { type: 'string' },
                    },
                },
                // --- Pasta de processos ---
                ProcessFolder: {
                    type: 'object',
                    properties: {
                        id:          { type: 'string' },
                        folderCode:  { type: 'string', example: 'Proc-0002091' },
                        description: { type: 'string', nullable: true },
                        assets:      { type: 'array', items: { $ref: '#/components/schemas/CreditAssetSummary' } },
                    },
                },
                // --- Usuário (resposta de gestão) ---
                UserManagementInfo: {
                    type: 'object',
                    properties: {
                        id:           { type: 'string' },
                        auth0UserId:  { type: 'string' },
                        email:        { type: 'string', format: 'email' },
                        name:         { type: 'string' },
                        picture:      { type: 'string', format: 'uri' },
                        roles:        { type: 'array', items: { type: 'string' } },
                        status:       { type: 'string', enum: ['ACTIVE', 'PENDING_REVIEW', 'PENDING_ONBOARDING'] },
                        associateName:{ type: 'string', nullable: true },
                        lastLogin:    { type: 'string', format: 'date-time', nullable: true },
                    },
                },
                // --- Perfil completo do usuário autenticado ---
                UserProfile: {
                    type: 'object',
                    properties: {
                        id:                   { type: 'string' },
                        name:                 { type: 'string' },
                        email:                { type: 'string', format: 'email' },
                        role:                 { type: 'string', enum: ['ADMIN', 'OPERATOR', 'INVESTOR', 'ASSOCIATE'] },
                        status:               { type: 'string', enum: ['ACTIVE', 'PENDING_REVIEW', 'PENDING_ONBOARDING'] },
                        cpfOrCnpj:            { type: 'string', nullable: true },
                        cellPhone:            { type: 'string', nullable: true },
                        profilePictureUrl:    { type: 'string', format: 'uri', nullable: true },
                        personalDocumentUrls: { type: 'array', items: { type: 'string' } },
                    },
                },
                // --- Notificação do sistema ---
                SystemNotification: {
                    type: 'object',
                    properties: {
                        id:        { type: 'string' },
                        title:     { type: 'string', example: 'Nova atualização disponível' },
                        message:   { type: 'string' },
                        type:      { type: 'string', enum: ['info', 'success', 'warning', 'error'], example: 'info' },
                        link:      { type: 'string', nullable: true },
                        createdAt: { type: 'string', format: 'date-time' },
                    },
                },
                // --- Paginação genérica ---
                PaginatedMeta: {
                    type: 'object',
                    properties: {
                        total:      { type: 'integer' },
                        page:       { type: 'integer' },
                        limit:      { type: 'integer' },
                        totalPages: { type: 'integer' },
                    },
                },
            },
        },
        // Aplica bearerAuth como padrão global (pode ser sobrescrito por endpoint)
        security: [{ bearerAuth: [] }],
        // ─── Tags de agrupamento ───────────────────────────────────────────────
        tags: [
            { name: 'Ativos',         description: 'Gestão de ativos judiciais (CreditAssets)' },
            { name: 'Pastas',         description: 'Agrupamento de processos em pastas (ProcessFolders)' },
            { name: 'Usuários',       description: 'Perfil e dados do usuário autenticado' },
            { name: 'Gestão',         description: 'Operações administrativas de usuários (apenas ADMIN)' },
            { name: 'Investimentos',  description: 'Consulta de carteira de investimentos' },
            { name: 'Notificações',   description: 'Sistema de notificações da plataforma' },
            { name: 'Legal One',      description: 'Integração e lookup na API do Legal One' },
        ],
    },
    // Aponta para todos os arquivos de rota onde os blocos @swagger estão escritos
    apis: ['./src/routes/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
