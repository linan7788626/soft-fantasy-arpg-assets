# NLI 地牢与主角动作套件 v0.5

本批新增1张原生嵌入式门扇，沿用已认可的圆润墙帽与奶油石材。累计保留25张套件原图，预览内嵌当前19张；角色动作仍为24帧行走、16帧推箱和4个独立待机姿态。原有224项基础素材和此前原图均保留。

## 预览与操作

打开仓库根目录 `Prototypes/DungeonWalk/index.html`，可单独复制离线打开。方向键/WASD移动，E推箱；支持三种房间、朝向/动作选择、动作演示、逐帧、帧率、深浅/棋盘背景及碰撞格。停止移动使用独立站姿。动作选择器用于逐帧检查，场景中的真实移动/推箱会选择相应动作。

推箱先按正常行走速度接近箱面，再用320ms推动箱子，最后100ms松手过渡至待机。手部接触点随箱面移动，箱子落定后判定压力板。自动靠近会检查路径和终点碰撞。箱子地面碰撞与高于地面的绘制轮廓分离，允许从箱后接近，不会把向下推箱者困在整格碰撞中。

## 四面墙与坐标

围墙厚40逻辑像素，墙面向上投影128，总投影高度168（上一版为88）。内外角保留12px圆角；石材按32px一层重复，避免把原有石块纵向拉长。门洞直接从同一面墙中扣除，宽80、高104；门扇嵌入76×100的区域。墙顶连续跨过入口，周围石缝共用同一套坐标，不再叠加独立石门框或门墩。

`Documentation/manifest.json` 中 `walls.layouts` 为两端共用的圆角轮廓、墙面变换和前景区域。`cap_outer_contours` 与 `cap_hole_contours` 分别记录墙帽外轮廓和室内空洞；`walls.gate.render_mode` 为 `carved-wall`，`opening.contour` 为实际门洞，`opening.leaf_rect` 为门扇位置。开门时隐藏门扇，墙体几何不变。旧版开/关门原图归档保留，不再参与当前渲染。

生成逻辑见 `Tools/wall_geometry.py`。网页用纹理填充与门洞裁切；Godot用缓存多边形、空洞扣除和重复纹理。所有操作只影响渲染，不改写PNG。高墙下的机关房通道扩为第3至5行，箱子与压力板移到第3行，保持通路可见。

`walks`、`idles`、`pushes` 记录方向动作。每帧含原图左上角坐标 `rect`、脚底 `pivot`，推箱另有 `contact`。`pixel_scale` 在一套图内固定，以头盔尺度校准；屈膝时不会将整帧重新拉到同一高度。`walk` 保留为向右行走的兼容入口。Unity基础metadata仍是单精灵导入，动作切帧以清单为准。

## 工具与证据

- `python3 Tools/build_prototype_kit.py`：只读分析PNG并重建清单、Unity metadata、kit-data.js。依赖 `Tools/kit-tests/requirements.txt`。
- `python3 Tools/kit-tests/native_art.py`：核对五批生成记录哈希、透明边界、帧范围与脚底坐标，不改图。
- `npm run build:preview`：将原图字节、清单和脚本内嵌为独立HTML。
- `npm run test:kit`：离线/独立托管、动作、推箱、机关、三布局墙帽连续性回归。
- `npm run build:godot`：复制原图与清单到独立Godot工程的可重建Art目录。
- `GODOT_RENDER=1 npm run test:godot`：真实Godot导入、运行与截图；普通 `npm run test:godot` 是无界面引擎测试。

网页报告/截图位于 `Prototypes/DungeonWalk/Validation/`，引擎报告/截图位于 `Prototypes/GodotImport/Validation/`。最新验收为 `Documentation/Acceptance_2026-11-05_integrated.md`。

提示词、参考图、原始生成输出与哈希分别见 `generation-records.json`、`round2-generation.json`、`round3-generation.json`、`round4-generation.json`、`round5-generation.json`。此前不合格白雾背景曾通过内置image_gen重新生成透明版本；交付文件均逐字节复制最后选用输出，没有本地抠图、缩放或裁切。

## 边界

这是一批可交互美术修订，仍待用户对步态、推箱姿态与新墙体外观作视觉验收。待机是单张静姿，没有呼吸循环；行走/披风仍可能有细节变化，不据此宣称完整角色动画生产定稿。攻击、受击与更多机关不在本批。

前景高墙会遮挡靠墙角色，尚未实现游戏中的遮挡淡化。门外目前只有出口测试地砖，未接入关卡切换。地板尚非完整自动铺砖集。墙体采用正交圆角连续几何；材质重复尚未证明逐像素对边一致。旧侧墙/柱继续保留为候选原图。Godot实机报告仅覆盖此试验工程；Unity Editor与完整PyQuest运行时集成尚未验收。
