"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const swagger_jsdoc_1 = __importDefault(require("swagger-jsdoc"));
const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'C2DI API',
            version: '1.0.0',
            description: 'Documentação da API C2DI.'
        }
    },
    apis: ['./docs/openapi.yaml'] // Caminho para seus arquivos de rotas TypeScript
};
const specs = (0, swagger_jsdoc_1.default)(options);
exports.default = specs;
