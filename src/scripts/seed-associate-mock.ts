/**
 * seed-associate-mock.ts
 * Cria 3 clientes fictícios com processos vinculados ao associado Matheus F. Lopes.
 * Excluir com: npx ts-node --transpile-only src/scripts/delete-associate-mock.ts
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const MOCK_TAG = 'MOCK_ASSOC_TEST'; // marcador nos emails para facilitar exclusão

async function main() {
    // 1. Encontrar o associado pelo CPF
    const associate = await prisma.user.findFirst({
        where: { cpfOrCnpj: '43413386840' },
        select: { id: true, name: true },
    });

    if (!associate) {
        console.error('Associado não encontrado (CPF 434.133.868-40). Verifique o CPF no banco.');
        process.exit(1);
    }

    console.log(`Associado encontrado: ${associate.name} (${associate.id})`);

    // 2. Criar 3 clientes fictícios
    const clientsData = [
        {
            name: 'Ricardo Almeida Santos',
            email: `ricardo.almeida.${MOCK_TAG}@mazzotini.placeholder`,
            auth0UserId: `mock|${MOCK_TAG}_001`,
            cpfOrCnpj: '98765432100',
        },
        {
            name: 'Ana Paula Ferreira',
            email: `ana.ferreira.${MOCK_TAG}@mazzotini.placeholder`,
            auth0UserId: `mock|${MOCK_TAG}_002`,
            cpfOrCnpj: '12398765400',
        },
        {
            name: 'Carlos Eduardo Mendes',
            email: `carlos.mendes.${MOCK_TAG}@mazzotini.placeholder`,
            auth0UserId: `mock|${MOCK_TAG}_003`,
            cpfOrCnpj: '45612378900',
        },
    ];

    const clients = [];
    for (const c of clientsData) {
        const user = await prisma.user.upsert({
            where: { email: c.email },
            update: {},
            create: {
                ...c,
                role: 'INVESTOR',
                status: 'ACTIVE',
            },
        });
        clients.push(user);
        console.log(`Cliente criado: ${user.name}`);
    }

    // 3. Criar processos fictícios (legalOneId alto para não colidir)
    const assetsData = [
        {
            legalOneId: 9990001,
            processNumber: '1001234-55.2019.8.26.0100',
            nickname: 'Almeida x Banco Nacional',
            originalCreditor: 'Ricardo Almeida Santos',
            otherParty: 'Banco Nacional S.A.',
            origemProcesso: 'MOCK',
            originalValue: 185000,
            acquisitionValue: 92500,
            currentValue: 127300,
            acquisitionDate: new Date('2021-03-15'),
            updateIndexType: 'SELIC',
            status: 'ACTIVE',
        },
        {
            legalOneId: 9990002,
            processNumber: '0034567-12.2020.8.26.0050',
            nickname: 'Ferreira x Construtora',
            originalCreditor: 'Ana Paula Ferreira',
            otherParty: 'Construtora Horizonte Ltda.',
            origemProcesso: 'MOCK',
            originalValue: 320000,
            acquisitionValue: 160000,
            currentValue: 198400,
            acquisitionDate: new Date('2022-06-01'),
            updateIndexType: 'IPCA',
            status: 'ACTIVE',
        },
        {
            legalOneId: 9990003,
            processNumber: '0098123-44.2018.8.26.0200',
            nickname: 'Mendes x Seguradora',
            originalCreditor: 'Carlos Eduardo Mendes',
            otherParty: 'Seguradora Vitória S.A.',
            origemProcesso: 'MOCK',
            originalValue: 95000,
            acquisitionValue: 47500,
            currentValue: 68200,
            acquisitionDate: new Date('2020-09-10'),
            updateIndexType: 'SELIC',
            status: 'ACTIVE',
        },
        {
            legalOneId: 9990004,
            processNumber: '0012345-78.2021.8.26.0300',
            nickname: 'Mendes x Município',
            originalCreditor: 'Carlos Eduardo Mendes',
            otherParty: 'Município de São Paulo',
            origemProcesso: 'MOCK',
            originalValue: 210000,
            acquisitionValue: 105000,
            currentValue: 143500,
            acquisitionDate: new Date('2022-01-20'),
            updateIndexType: 'IPCA',
            status: 'ACTIVE',
        },
    ];

    const assets = [];
    for (const a of assetsData) {
        const asset = await prisma.creditAsset.upsert({
            where: { legalOneId: a.legalOneId },
            update: {},
            create: a,
        });
        assets.push(asset);
        console.log(`Processo criado: ${asset.nickname}`);
    }

    // Adicionar andamentos fictícios
    const updatesData = [
        { assetId: assets[0].id, description: '#RelatórioMAA\nValor da Causa: R$ 185.000,00\nValor da Compra: R$ 92.500,00\nValor Atualizado: R$ 127.300,00\nAudiência de instrução realizada. Aguardando sentença.', updatedValue: 127300, date: new Date('2024-11-20'), source: 'MOCK' },
        { assetId: assets[1].id, description: '#RelatórioMAA\nValor da Causa: R$ 320.000,00\nValor da Compra: R$ 160.000,00\nValor Atualizado: R$ 198.400,00\nPerícia técnica concluída. Laudo juntado aos autos.', updatedValue: 198400, date: new Date('2025-02-10'), source: 'MOCK' },
        { assetId: assets[2].id, description: '#RelatórioMAA\nValor da Causa: R$ 95.000,00\nValor da Compra: R$ 47.500,00\nValor Atualizado: R$ 68.200,00\nRécurso de apelação interposto. Aguardando pauta no TJ.', updatedValue: 68200, date: new Date('2025-03-05'), source: 'MOCK' },
        { assetId: assets[3].id, description: '#RelatórioMAA\nValor da Causa: R$ 210.000,00\nValor da Compra: R$ 105.000,00\nValor Atualizado: R$ 143.500,00\nCitação do réu realizada. Prazo para contestação em curso.', updatedValue: 143500, date: new Date('2025-01-15'), source: 'MOCK' },
    ];

    for (const u of updatesData) {
        await prisma.assetUpdate.create({ data: u });
    }
    console.log('Andamentos criados.');

    // 4. Criar investimentos vinculando cliente + processo + associado
    const investmentsData = [
        { userId: clients[0].id, creditAssetId: assets[0].id }, // Ricardo → processo 1
        { userId: clients[1].id, creditAssetId: assets[1].id }, // Ana    → processo 2
        { userId: clients[2].id, creditAssetId: assets[2].id }, // Carlos → processo 3
        { userId: clients[2].id, creditAssetId: assets[3].id }, // Carlos → processo 4 (2 processos)
    ];

    for (const inv of investmentsData) {
        await prisma.investment.create({
            data: {
                ...inv,
                investorShare: 100,
                mazzotiniShare: 0,
                associateId: associate.id,
            },
        });
    }

    console.log('\n✅ Mock criado com sucesso!');
    console.log(`   3 clientes, 4 processos, 4 andamentos vinculados ao associado ${associate.name}`);
    console.log('   Para excluir: npx ts-node --transpile-only src/scripts/delete-associate-mock.ts');
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
