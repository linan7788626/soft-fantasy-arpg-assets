// Package native PNG bytes unchanged so the HTML works outside the repository tree.
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const kit=resolve(root,'Assets/NLI_Prototype_Kit');
const manifest=JSON.parse(await readFile(resolve(kit,'Documentation/manifest.json'),'utf8'));
const data=structuredClone(manifest);data.embeddedImages={};
for(const [id,file] of [...data.assets.map(a=>[a.id,a.file]),['walk',data.walk.file]])data.embeddedImages[id]='data:image/png;base64,'+(await readFile(resolve(kit,file))).toString('base64');
const script=await readFile(resolve(root,'Prototypes/DungeonWalk/preview.js'),'utf8');
let html=await readFile(resolve(root,'Prototypes/DungeonWalk/index.template.html'),'utf8');
html=html.replace('<script src="kit-data.js"></script>',`<script>const KIT=${JSON.stringify(data).replaceAll('</','<\\/')}</script>`).replace('<script src="preview.js"></script>',`<script>${script.replaceAll('</script','<\\/script')}</script>`);
const jsonUri='data:application/json;base64,'+Buffer.from(JSON.stringify(manifest,null,2)).toString('base64');
html=html.replace('href="../../Assets/NLI_Prototype_Kit/Documentation/manifest.json"',`download="nli-kit-manifest.json" href="${jsonUri}"`);
html=html.replace('<a href="../../Assets/NLI_Prototype_Kit/README.md">使用与验收说明</a>','<span>本页含全部9张图像，可单独复制离线打开。当前为向右6帧动作测试，尚非四方向动画包。</span>');
await writeFile(resolve(root,'Prototypes/DungeonWalk/index.html'),html);
console.log(`Built standalone preview with ${Object.keys(data.embeddedImages).length} native PNGs (${Buffer.byteLength(html)} bytes).`);
