const { createDefaultPreset } = require("ts-jest");

const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import("jest").Config} **/
module.exports = {
    testEnvironment: "node",
    transform: {
        ...tsJestTransformCfg,
    },
    testMatch: [
        "<rootDir>/src/__tests__/**/*.test.ts",
        "<rootDir>/src/**/*.spec.ts"
    ],
    // Carrega variáveis de ambiente de teste ANTES de qualquer import
    setupFiles: [
        "<rootDir>/src/__tests__/envSetup.ts"
    ],
    // Timeout maior por causa de chamadas ao banco
    testTimeout: 30000,
    // Um worker por vez: evita race conditions no banco de testes
    maxWorkers: 1,
    verbose: true,
};
