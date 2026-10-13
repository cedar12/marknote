/* Standalone tests for the real Rust file-version and attachment helpers.
 * This verifies helpers against cached Rust dependencies, not the full Tauri build. */
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const compilerName=process.platform==='win32'?'rustc.exe':'rustc';
const toolchainDirectory=path.join(os.homedir(),'.rustup','toolchains');
const preferred=name=>Number(!name.startsWith('stable'))*2+Number(process.platform==='win32'&&!name.endsWith('windows-msvc'));
const compilers=process.env.MARKNOTE_RUSTC?[process.env.MARKNOTE_RUSTC]:['rustc',...(fs.existsSync(toolchainDirectory)?fs.readdirSync(toolchainDirectory).sort((a,b)=>preferred(a)-preferred(b)).map(name=>path.join(toolchainDirectory,name,'bin',compilerName)):[])];
const rustc=compilers.find(compiler=>spawnSync(compiler,['--version'],{encoding:'utf8',windowsHide:true}).status===0);
const deps=path.join(root,'src-tauri','target','debug','deps');
const output=path.join(root,'outputs','file-version-native');
if(!rustc||!fs.existsSync(deps))throw Error('A matching Rust compiler and cached dependencies are required. Set MARKNOTE_RUSTC.');
fs.mkdirSync(output,{recursive:true});
function compile(args){return spawnSync(rustc,args,{cwd:root,encoding:'utf8',windowsHide:true});}
function dependency(name,fixed){
  const candidates=fixed?[fixed]:fs.readdirSync(deps).filter(file=>file.startsWith('lib'+name+'-')&&file.endsWith('.rlib'));
  const source=path.join(output,'probe-'+name+'.rs');
  fs.writeFileSync(source,`extern crate ${name}; ${name==='serde'?'#[derive(serde::Serialize,serde::Deserialize)] pub struct Probe { value:u8 }':'pub fn probe() {}'}`);
  for(const candidate of candidates){
    const library=path.join(deps,candidate);
    const result=compile([source,'--edition=2021','--crate-type=lib','--emit=metadata','-L','dependency='+deps,
      '--extern',name+'='+library,'-o',path.join(output,'probe-'+name+'.rmeta')]);
    if(result.status===0)return name+'='+library;
  }
  throw Error('No cached '+name+' dependency matches '+rustc);
}
let source=fs.readFileSync(path.join(root,'src-tauri','src','cmd','file_version.rs'),'utf8')
  .replace(/^use tauri::[^\n]+\r?\n/m,'')
  .replace(/#\[tauri::command\(async\)\]/g,'')
  .replace(/pub fn emit_saved\([\s\S]*?(?=\r?\n#\[cfg\(test\)\])/m,'');
const attachments=fs.readFileSync(path.join(root,'src-tauri','src','utils','attachments.rs'),'utf8');
const harness=path.join(output,'harness.rs');
fs.writeFileSync(harness,'#[macro_use] extern crate lazy_static;\nmod file_version {\n'+source+'\n}\nmod attachments {\n'+attachments+'\n}\n');
const externs=['serde','log','lazy_static','sha2','anyhow','url'].map(name=>dependency(name));
fs.writeFileSync(path.join(output,'dependencies.json'),JSON.stringify(externs,null,2));
const executable=path.join(output,'harness-'+Date.now()+(process.platform==='win32'?'.exe':''));
const result=compile([harness,'--edition=2021','--test','--cap-lints=allow','-L','dependency='+deps,...externs.flatMap(value=>['--extern',value]),'-o',executable]);
if(result.status!==0){process.stderr.write(result.stdout+result.stderr);process.exit(result.status||1);}
const tests=spawnSync(executable,[],{cwd:root,encoding:'utf8',windowsHide:true});
process.stdout.write(tests.stdout);process.stderr.write(tests.stderr);
process.exitCode=tests.status||0;
