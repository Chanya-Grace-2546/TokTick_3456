import { createServer } from '../client/node_modules/vite/dist/node/index.js';
import { createServer as createNetServer } from 'node:net';
import { fileURLToPath } from 'node:url';
try {
  const reserved=createNetServer();await new Promise<void>(resolve=>reserved.listen(0,'127.0.0.1',resolve));const allocated=reserved.address();if(!allocated||typeof allocated==='string')throw new Error('Port allocation failed');await new Promise<void>((resolve,reject)=>reserved.close(error=>error?reject(error):resolve()));
  const server=await createServer({root:fileURLToPath(new URL('../client',import.meta.url)),server:{host:'127.0.0.1',port:Number(process.env.TOKTICKIT_E2E_FRONTEND_PORT)||allocated.port,strictPort:true},configFile:false,plugins:[(await import('../client/node_modules/@vitejs/plugin-react/dist/index.js')).default()]});
  await server.listen();const address=server.httpServer?.address();if(address && typeof address!=='string')process.send?.({ready:true,port:address.port});
  const stop=async()=>{await server.close();process.exit(0);};
  process.on('SIGTERM',stop);process.on('disconnect',stop);
} catch {process.send?.({ready:false});process.exit(1);}
