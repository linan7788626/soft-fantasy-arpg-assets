import {spawnSync} from 'node:child_process';
import {mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const engine=process.env.GODOT_BIN||'/Applications/Godot.app/Contents/MacOS/Godot';
const project=resolve('Prototypes/GodotImport');
const out=resolve(project,'Validation');await mkdir(out,{recursive:true});
await rm(resolve(out,'report.json'),{force:true});
function run(args,name){
 const r=spawnSync(engine,args,{encoding:'utf8',timeout:name==='import'?60000:15000});
 const log=(r.stdout||'')+(r.stderr||'');
 return writeFile(resolve(out,name+'.log'),log).then(()=>{
  assert(!r.error,`${name}: ${r.error}`);assert.equal(r.status,0,`${name}: ${log}`);
  assert(!/SCRIPT ERROR|Parse Error|Assertion failed|^ERROR:/m.test(log),log);
 });
}
await run(['--headless','--editor','--path',project,'--import'],'import');
const headless=process.env.GODOT_RENDER!=='1';
await run([...(headless?['--headless']:[]),'--path',project,'--','--verify'],'runtime');
const report=JSON.parse(await readFile(resolve(out,'report.json'),'utf8'));assert.equal(report.status,'passed');
console.log(JSON.stringify(report));
