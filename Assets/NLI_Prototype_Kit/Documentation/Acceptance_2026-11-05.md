# 等高门墙与圆润 Soft Fantasy 材质 · 2026-11-05

## 交付与视觉目标

本批针对用户提出的“墙门一样高、俯视封闭房间、石材更圆润”修订。新增4张原生PNG：`Wall_Cap_Soft_v4.png`、`Wall_Face_Soft_v4.png`、`Door_Closed_Soft_v4.png`、`Door_Open_Soft_v4.png`。位于本套件 `Sprites/`，累计保留24张套件原图；交互预览内嵌当前20张。角色动作、本轮之前的原图及224项基础素材未覆盖。

墙帽为柔和蓝灰色、圆角枕形石块；墙面为奶油色两层错缝圆润石材。入口改成嵌入围墙的低矮门框，去掉原高塔入口的尖顶、旗饰和城垛造型。门框横向覆盖墙口，两侧少量搭接，用于封住圆润端部的接缝。

## 高度与几何

修订前门画面高度192px，墙体总投影高度48px，比例失衡。`node Tools/kit-tests/enclosure.mjs` 在原版复现 `192 !== 48`，作为本轮验收基线。

新墙体占地厚40逻辑像素，统一向屏幕上方投影48像素，总画面高度88像素；门框使用同一顶部与基线，画面高度也为88像素。以房间原点Y=196计算，墙顶为Y=128；闭门实际不透明顶部为Y=129，开门为Y=128，差异来自原生抗锯齿，均在1px内。

内外转角使用12px半径的二次曲线轮廓，墙面沿曲线向下投影，拐角立面因此也圆润衔接。墙帽、墙面取样与几何倒角均在渲染时完成，没有修改源PNG。开关门共用同一个源图矩形和目标矩形，避免状态切换时缩放外框。

网页使用圆角轮廓裁切与纹理填充；Godot读取同一清单，用抗锯齿Polygon2D和多边形交集处理前景遮挡。实现API参考：[Polygon2D](https://docs.godotengine.org/en/stable/classes/class_polygon2d.html)、[Geometry2D](https://docs.godotengine.org/en/stable/classes/class_geometry2d.html)。两端都保留角色在墙后、门洞内与门外的绘制顺序。

## 原图与生成记录

使用内置image_gen生成。实际提示词、参考图、原始输出路径和SHA-256见 `round4-generation.json`。两张材质为完整不透明纹理，门的两状态为透明背景完整模块。交付文件逐字节复制生成输出；无本地抠图、裁切、缩放、插帧或模糊处理。

## 验证结果

- `python3 Tools/kit-tests/native_art.py`：四批生成记录哈希、原生尺寸、透明边界、动作坐标检查通过。20张加载图对应23项模块/clip记录。
- `npm run test:kit`：离线和仅预览目录托管、三布局、四方向动作、静止停帧、推箱接触和路径保护、压力板复位、门洞通行均通过。
- 墙帽连续性：1683个采样点通过。测试现在隔离墙帽平面并检查覆盖，支持新的柔和石材色彩，不再用固定蓝色阈值判断美术。
- 封闭房间测试：三布局的开门/关门状态均通过顶部齐平检查，且实际圆角外侧Alpha=0、内侧Alpha=255，确认圆角存在于画面轮廓。
- `GODOT_RENDER=1 npm run test:godot`：Godot 4.7.2在macOS原生窗口实际导入和运行，通过等高门墙、圆角轮廓、动作、推箱、机关和三布局检查，保存引擎截图。

网页证据在 `Prototypes/DungeonWalk/Validation/`，重点为 `enclosure-report.json` 与 `enclosed-*-open/closed.png`。引擎证据在 `Prototypes/GodotImport/Validation/`，重点为 `report.json` 与 `walls-*.png`。修订前画面保存在网页证据目录的 `enclosure-before.png`。

## 使用与范围

打开 `Prototypes/DungeonWalk/index.html` 查看新版；支持房间和门状态切换。Godot先执行 `npm run build:godot`，再打开 `Prototypes/GodotImport/project.godot`，按1/2/3切换布局。

本批已验证几何、渲染和交互，Soft Fantasy美术观感仍由用户确认。材质重复未声明逐像素对边完全一致；完整自动铺砖、Unity Editor导入、完整PyQuest集成和更多机关仍未验收。
