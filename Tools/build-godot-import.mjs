// Copy native bytes into a reproducible, disposable Godot import project.
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const kit=resolve(root,'Assets/NLI_Prototype_Kit');
const dest=resolve(root,'Prototypes/GodotImport/Art');
const manifest=JSON.parse(await readFile(resolve(kit,'Documentation/manifest.json'),'utf8'));
await mkdir(resolve(dest,'Sprites'),{recursive:true});
const files=new Set([...manifest.assets.map(a=>a.file),...Object.values(manifest.walks).map(w=>w.file)]);
for(const file of files)await copyFile(resolve(kit,file),resolve(dest,file));
await writeFile(resolve(dest,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(`Godot staging: ${files.size} byte-identical PNGs and calibrated manifest.`);
