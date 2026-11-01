import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {startProcess,stopOwnedProcesses} from '../processes';
// UI-only: no database helper, migration, account preparation or backend process.
export default async function setup(){
 const directory=mkdtempSync(path.join(tmpdir(),'toktickit-ui-'));
 const cleanup=async()=>{await stopOwnedProcesses();rmSync(directory,{recursive:true,force:true});};
 const env:NodeJS.ProcessEnv={...process.env,VITE_API_URL:'http://localhost:1',TOKTICKIT_E2E_WORKDIR:directory};
 delete env['TOKTICKIT_E2E_FRONTEND_PORT'];
 try{
  const frontend=await startProcess('frontend',env);
  process.env.TOKTICKIT_E2E_BASE_URL=frontend.origin;
  return cleanup;
 }catch{await cleanup();throw new Error('Mock UI frontend could not start.');}
}
