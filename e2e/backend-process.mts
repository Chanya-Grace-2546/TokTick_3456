import { PrismaClient } from '../server/node_modules/@prisma/client/index.js';
import { verifyE2ETarget } from '../server/tests/helpers/e2eSafety.mjs';
const prisma=new PrismaClient();
try {
  await verifyE2ETarget(prisma);
  await prisma.$disconnect();
  const { app }=await import('../server/src/app.ts');
  const server=app.listen(0,'127.0.0.1',()=>{const address=server.address();if(address && typeof address!=='string')process.send?.({ready:true,port:address.port});});
  const stop=()=>server.close(()=>process.exit(0));
  process.on('SIGTERM',stop);process.on('disconnect',stop);
} catch { process.send?.({ready:false});await prisma.$disconnect();process.exit(1); }
