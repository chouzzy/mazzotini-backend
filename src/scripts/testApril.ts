import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
function mR(sy:number,sm:number,ey:number,em:number){const r:{year:number;month:number}[]=[];let y=sy,m=sm;while(y<ey||(y===ey&&m<=em)){r.push({year:y,month:m});m++;if(m>12){m=1;y++;}}return r;}
(async()=>{
  const p3range=mR(2024,9,2026,4);
  const [sR,iR]=await Promise.all([
    prisma.indexSeries.findMany({where:{indexName:'SELIC',OR:p3range.map(r=>({year:r.year,month:r.month}))}}),
    prisma.indexSeries.findMany({where:{indexName:'IPCA', OR:p3range.map(r=>({year:r.year,month:r.month}))}}),
  ]);
  const sM=new Map(sR.map(r=>[`${r.year}-${String(r.month).padStart(2,'0')}`,r.monthlyRate]));
  const iM=new Map(iR.map(r=>[`${r.year}-${String(r.month).padStart(2,'0')}`,r.monthlyRate]));
  const C=4863273.70, T=14127167.22;

  const configs = [
    { label: 'P1<=Jan/03 | P2 fev/03-ago/24 | P3 set/24+ (ATUAL)', p1: (y:number,m:number)=>y<2003||(y===2003&&m<=1) },
    { label: 'P1<=Dez/02 | P2 jan/03-ago/24 | P3 set/24+',          p1: (y:number,m:number)=>y<=2002               },
  ];

  for (const cfg of configs) {
    const months=mR(2000,1,2026,4);
    let tot=0,p1=0,p2=0,p3=0;
    for(const{year:y,month:m}of months){
      let r:number;
      if(cfg.p1(y,m)){r=0.5;p1++;}
      else if(y<2024||(y===2024&&m<=8)){r=1.0;p2++;}
      else{const k=`${y}-${String(m).padStart(2,'0')}`;r=Math.max((sM.get(k)??0)-(iM.get(k)??0),0);p3++;}
      tot+=r;
    }
    const mor=C*tot/100;
    console.log(`\n${cfg.label}`);
    console.log(`  P1=${p1}m  P2=${p2}m  P3=${p3}m`);
    console.log(`  Juros:    R$ ${mor.toFixed(2)}`);
    console.log(`  drcalc:   R$ ${T.toFixed(2)}`);
    console.log(`  Diferença: R$ ${(mor-T).toFixed(2)}`);
  }
  await prisma.$disconnect();
})().catch(async e=>{console.error(e);await prisma.$disconnect();});
