/**
 * Carrega variáveis de ambiente do .env.test ANTES de qualquer módulo ser importado.
 * Isso garante que o PrismaClient aponte para o banco de testes.
 */
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });
