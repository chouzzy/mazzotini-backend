import swaggerJSDoc from 'swagger-jsdoc';

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API',
      version: '1.0.0',
      description: 'Documentação da API'
    }
  },
  apis: ['./docs/openapi.yaml'] // Caminho para seus arquivos de rotas TypeScript
};

const specs = swaggerJSDoc(options);

export default specs;