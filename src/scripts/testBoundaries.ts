import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

function mRange(sy: number, sm: number, ey: number, em: number) {
    const r: { year: number; month: number }[] = [];
    let y = sy, m = sm;
    while (y < ey || (y === ey && m <= em)) { r.push({ year: y, month: m }); m++; if (m > 12) { m = 1; y++; } }
    return r;
}

(async () => {
    const p3Range = mRange(2024, 8, 2026, 5);
    const [sR, iR] = await Promise.all([
        prisma.indexSeries.findMany({ where: { indexName: 'SELIC', OR: p3Range.map(r => ({ year: r.year, month: r.month })) } }),
        prisma.indexSeries.findMany({ where: { indexName: 'IPCA',  OR: p3Range.map(r => ({ year: r.year, month: r.month })) } }),
    ]);
    const sM = new Map(sR.map(r => [`${r.year}-${String(r.month).padStart(2, '0')}`, r.monthlyRate]));
    const iM = new Map(iR.map(r => [`${r.year}-${String(r.month).padStart(2, '0')}`, r.monthlyRate]));

    const C = 4906556.83, T = 14290614.32;
    console.log(`Target rate: ${(T / C * 100).toFixed(4)}%\n`);

    const cfgs = [
        { l: 'P1<=Dec/02, P3>=Aug/24, inclBase', p1e: { y: 2002, m: 12 }, p3s: { y: 2024, m: 8 }, base: true  },
        { l: 'P1<=Dec/02, P3>=Sep/24, inclBase', p1e: { y: 2002, m: 12 }, p3s: { y: 2024, m: 9 }, base: true  },
        { l: 'P1<=Jan/03, P3>=Aug/24, inclBase', p1e: { y: 2003, m: 1  }, p3s: { y: 2024, m: 8 }, base: true  },
        { l: 'P1<=Jan/03, P3>=Sep/24, inclBase', p1e: { y: 2003, m: 1  }, p3s: { y: 2024, m: 9 }, base: true  },
        { l: 'P1<=Dec/02, P3>=Aug/24, noBase',   p1e: { y: 2002, m: 12 }, p3s: { y: 2024, m: 8 }, base: false },
        { l: 'P1<=Dec/02, P3>=Sep/24, noBase',   p1e: { y: 2002, m: 12 }, p3s: { y: 2024, m: 9 }, base: false },
        { l: 'P1<=Jan/03, P3>=Aug/24, noBase',   p1e: { y: 2003, m: 1  }, p3s: { y: 2024, m: 8 }, base: false },
        { l: 'P1<=Jan/03, P3>=Sep/24, noBase',   p1e: { y: 2003, m: 1  }, p3s: { y: 2024, m: 9 }, base: false },
    ];

    for (const c of cfgs) {
        const months = mRange(2000, c.base ? 1 : 2, 2026, 5);
        let tot = 0, p1 = 0, p2 = 0, p3 = 0;
        for (const { year: y, month: m } of months) {
            let r: number;
            if (y < c.p1e.y || (y === c.p1e.y && m <= c.p1e.m)) { r = 0.5; p1++; }
            else if (y < c.p3s.y || (y === c.p3s.y && m < c.p3s.m)) { r = 1.0; p2++; }
            else {
                const k = `${y}-${String(m).padStart(2, '0')}`;
                r = Math.max((sM.get(k) ?? 0) - (iM.get(k) ?? 0), 0);
                p3++;
            }
            tot += r;
        }
        const mor = C * tot / 100;
        const diff = mor - T;
        console.log(`${c.l}`);
        console.log(`  P1=${p1}m  P2=${p2}m  P3=${p3}m  total=${(p1+p2+p3)}m`);
        console.log(`  rate=${tot.toFixed(4)}%  moratory=R$ ${mor.toFixed(2)}  diff=${diff > 0 ? '+' : ''}${diff.toFixed(2)}\n`);
    }

    await prisma.$disconnect();
})().catch(async e => { console.error(e); await prisma.$disconnect(); });
