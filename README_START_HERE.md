# PyQuest · NLI Soft Fantasy ARPG v0.2.1

219 项旧素材逐项重绘，4 项已认可的传送门和城堡原图保留，新增 1 位 NPC 长老；共 224 张 PNG 和 224 个静态 Prefab。
本包使用内置 image_gen，保留每次最终生成的原生 PNG 像素和 Alpha，没有插值放大、抠背景或二次裁切。

[打开完整预览网页](Assets/NLI_SoftFantasy_ARPG/Previews/Asset_Catalog.html)：搜索、分类、新旧对照、放大、深浅背景、单张下载。
可直接离线打开。旧图仅作为对照归档，不计入 224 张新版素材。

## 使用
将 Assets/NLI_SoftFantasy_ARPG 及同级 .meta 导入 Unity；或使用配套 unitypackage。
新版继承旧版对应 Sprite / Prefab GUID，应作为同一素材包的升级版本使用。
所有图像的原始尺寸记于 Documentation/Asset_Manifest.json，勿按文件名假设统一画布。
默认 100 PPU、中心 Pivot、Bilinear、Clamp、无压缩、无非幂次缩放；实际游戏显示比例和脚底锚点需要校准。
可选菜单 Tools > NLI Soft Fantasy > Open Asset Browser / Create Gallery Scene。

## 内容与来源
- Sprites/：224 张最终可用图像；Prefabs/：对应静态 SpriteRenderer 容器。
- Source/Generated/：224 张原生生成源图副本。
- Source/Legacy_Sprites/：219 张旧图，供新旧对照。
- Source_Crops/：219 张旧设计参考；Source/Approved_Reference_1536x1024.png：最初总图。
- Documentation/Generation_Records/：220 项实际提示词、参考图、原始输出路径、哈希、尺寸和视觉检查记录。
- Documentation/Generation_Prompts/：4 张已认可原图及 NPC 长老的提示词。
- Previews/Asset_Catalog.html：当前完整图鉴；Legacy_Reference/ 中的旧联系表仅作历史参考。

## 适用范围
本次完成美术重绘与素材包更新，没有改动 PyQuest 游戏运行代码。
角色与怪物是独立静态姿态，尚未校准为连续动画；地形样本尚未验证无缝拼接。
Prefab 不含碰撞、AI、Animator 或游戏逻辑。文件校验不等同于实际 Unity 编辑器导入验证。
柔光的半透明像素完整保留；地形样本的实体表面可以不透明。
小、中、大城堡表示建筑构造等级，世界尺寸尚未统一。

风格：NL-ARPG-SOFT-766DF2B7，暖光软绘奇幻 ARPG。

## NPC 长老（2026-10-28 新增）

角色文件：Sprites/Characters/NPCs/NPC_Elder.png；对应 Prefabs/Characters/NPCs/NPC_Elder.prefab。1254×1254 原生透明 PNG，奶油白长袍、蓝金披肩、白发长须和木质手杖。单个静态站立姿态；未加入游戏行为或连续动画。当前预览可搜索 NPC、Elder 或长老。
