import { fork, ChildProcess } from 'node:child_process';
import path from 'node:path';
const root = path.resolve(__dirname, '..');
const owned = new Set<ChildProcess>();
export async function stopOwnedProcesses() {
 const results=await Promise.allSettled([...owned].map(stopProcess));
 if(results.some(result=>result.status==='rejected'))throw new Error('Owned process shutdown failed; schema preserved.');
}
export async function stopProcess(child: ChildProcess) {
  if (child.exitCode !== null || child.signalCode !== null) { owned.delete(child); return; }
  let timer: NodeJS.Timeout, killTimer: NodeJS.Timeout;
  await new Promise<void>((resolve,reject)=>{
    const done=()=>{clearTimeout(timer);clearTimeout(killTimer);owned.delete(child);resolve();};
    child.once('exit',done);
    child.kill('SIGTERM');
    timer=setTimeout(()=>{
      child.kill('SIGKILL');
      killTimer=setTimeout(()=>{child.removeListener('exit',done);reject(new Error('Owned process did not stop; schema retained.'));},5000);
    },5000);
  });
}
export async function startProcess(kind: 'backend' | 'frontend', env: NodeJS.ProcessEnv) {
  const child = fork(path.join(__dirname, `${kind}-process.mts`), [], {
    cwd: env.TOKTICKIT_E2E_WORKDIR, env,
    execArgv: ['--import', path.join(root, 'server/node_modules/tsx/dist/loader.mjs')],
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
  });
  owned.add(child);
  try {
    const origin = await new Promise<string>((resolve,reject) => {
      const timer=setTimeout(()=>reject(new Error(`Owned ${kind} readiness timed out.`)),30000);
      child.once('error',()=>{clearTimeout(timer);reject(new Error(`Owned ${kind} could not start.`));});
      child.once('exit',()=>{clearTimeout(timer);reject(new Error(`Owned ${kind} stopped before readiness.`));});
      child.once('message',(message: any)=>{clearTimeout(timer);if(message?.ready && Number.isInteger(message.port) && message.port>0 && message.port<=65535)resolve(`http://localhost:${message.port}`);else reject(new Error(`Owned ${kind} refused startup.`));});
    });
    return { child, origin };
  } catch { await stopProcess(child); throw new Error(`Owned ${kind} failed safe startup; diagnostics withheld.`); }
}
