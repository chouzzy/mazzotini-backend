import { Router } from 'express';
import { requireApprovedAccount } from '../middleware/requireApprovedAccount';
import { checkJwt } from '../middleware/auth';

// Só a montagem das rotas importa aqui: nada de banco, Auth0 nem Spaces
jest.mock('@prisma/client', () => ({ PrismaClient: jest.fn(() => ({})) }));
jest.mock('../middleware/auth', () => ({ checkJwt: jest.fn() }));
jest.mock('../services/fileUploadService', () => ({ fileUploadService: {} }));

import { creditAssetRoutes } from './creditAsset.routes';
import { investmentRoutes } from './investment.routes';
import { documentRoutes } from './document.routes';
import { associateRoutes } from './associate.routes';

/** Os middlewares e o handler de uma rota, na ordem. */
const chain = (router: Router, method: string, path: string): unknown[] => {
    const layer = (router as any).stack.find((l: any) => l.route?.path === path && l.route.methods[method]);
    if (!layer) throw new Error(`rota não encontrada: ${method.toUpperCase()} ${path}`);
    return layer.route.stack.map((s: any) => s.handle);
};

const routers: Record<string, Router> = {
    creditAsset: creditAssetRoutes,
    investment:  investmentRoutes,
    document:    documentRoutes,
    associate:   associateRoutes,
};

describe('rotas com dados de cliente', () => {
    it.each([
        ['creditAsset', 'get',   '/api/assets'],
        ['creditAsset', 'get',   '/api/assets/folders'],
        ['creditAsset', 'get',   '/api/assets/:legalOneId'],
        ['creditAsset', 'get',   '/api/assets/:assetId/estimate'],
        ['investment',  'get',   '/api/investments/me'],
        ['investment',  'patch', '/api/investments/:investmentId/associate'],
        ['document',    'get',   '/api/documents/private'],
        ['document',    'get',   '/api/documents/:id/download-url'],
        ['associate',   'get',   '/api/associate/dashboard'],
        ['associate',   'get',   '/api/associate/clients/:clientId/processes'],
        ['associate',   'get',   '/api/associate/processes'],
    ])('%s: %s %s exige conta aprovada, depois do token', (name, method, path) => {
        const handlers = chain(routers[name], method, path);

        expect(handlers).toContain(requireApprovedAccount);
        expect(handlers.indexOf(requireApprovedAccount)).toBeGreaterThan(handlers.indexOf(checkJwt));
        // O controller vem por último
        expect(handlers[handlers.length - 1]).not.toBe(requireApprovedAccount);
    });
});
