# NLI 地牢与主角动作套件 v0.3

本批新增7张原生PNG：四方向独立待机共用1张、四方向推箱各1张、向上/向下行走精修各1张。累计保留20张套件原图，预览内嵌其中18张。当前动作覆盖24帧行走、16帧推箱、4个独立待机姿态。原有224项基础素材和此前套件原图均保留。

## 预览与操作

打开仓库根目录 `Prototypes/DungeonWalk/index.html`，可单独复制离线打开。方向键/WASD移动，E推箱；支持三种房间、朝向/动作选择、动作演示、逐帧、帧率、深浅/棋盘背景及碰撞格。停止移动使用独立站姿。动作选择器用于逐帧检查，场景中的真实移动/推箱会选择相应动作。

推箱先按正常行走速度接近箱面，再用320ms推动箱子，最后100ms松手过渡至待机。手部接触点随箱面移动，箱子落定后判定压力板。自动靠近会检查路径和终点碰撞。箱子地面碰撞与高于地面的绘制轮廓分离，允许从箱后接近，不会把向下推箱者困在整格碰撞中。

## 四面墙与坐标

横墙、原侧墙、角柱的透视和纹理本来不一致，旧版依赖高角柱覆盖端点。新版先合并墙体占地，再统一向屏幕上方投影高度：厚24逻辑像素、高24逻辑像素，内外直角和墙段共享墙帽平面。四面墙均从原生 `Wall_Horizontal.png` 的墙帽/墙面区域取材，不再以有窗侧墙或高角柱遮接缝。候选原图继续保留。

`Documentation/manifest.json` 中 `walls.layouts` 为两端共用的渲染区域清单，生成逻辑见 `Tools/wall_geometry.py`。大厅、L形回廊、机关房均使用此方案；门框替换北墙三格，保持开门通路。所有拼装和取样发生在渲染时，没有修改源PNG。

`walks`、`idles`、`pushes` 记录方向动作。每帧含原图左上角坐标 `rect`、脚底 `pivot`，推箱另有 `contact`。`pixel_scale` 在一套图内固定，以头盔尺度校准；屈膝时不会将整帧重新拉到同一高度。`walk` 保留为向右行走的兼容入口。Unity基础metadata仍是单精灵导入，动作切帧以清单为准。

## 工具与证据

- `python3 Tools/build_prototype_kit.py`：只读分析PNG并重建清单、Unity metadata、kit-data.js。依赖 `Tools/kit-tests/requirements.txt`。
- `python3 Tools/kit-tests/native_art.py`：核对三批生成记录哈希、透明边界、帧范围与脚底坐标，不改图。
- `npm run build:preview`：将原图字节、清单和脚本内嵌为独立HTML。
- `npm run test:kit`：离线/独立托管、动作、推箱、机关、三布局墙帽连续性回归。
- `npm run build:godot`：复制原图与清单到独立Godot工程的可重建Art目录。
- `GODOT_RENDER=1 npm run test:godot`：真实Godot导入、运行与截图；普通 `npm run test:godot` 是无界面引擎测试。

网页报告/截图位于 `Prototypes/DungeonWalk/Validation/`，引擎报告/截图位于 `Prototypes/GodotImport/Validation/`。最新验收为 `Documentation/Acceptance_2026-11-04.md`。

提示词、参考图、原始生成输出与哈希分别见 `generation-records.json`、`round2-generation.json`、`round3-generation.json`。本批不合格白雾背景曾通过内置image_gen重新生成透明版本；交付文件均逐字节复制最后选用输出，没有本地抠图、缩放或裁切。

## 边界

这是一批可交互美术修订，仍待用户对步态、推箱姿态与新墙体外观作视觉验收。待机是单张静姿，没有呼吸循环；行走/披风仍可能有细节变化，不据此宣称完整角色动画生产定稿。攻击、受击与更多机关不在本批。

地板尚非完整自动铺砖集。墙体采用正交连续几何，旧侧墙/柱的独立美术不因此成为可无缝拼接件。Godot实机报告仅覆盖此试验工程；Unity Editor与完整PyQuest运行时集成尚未验收。
