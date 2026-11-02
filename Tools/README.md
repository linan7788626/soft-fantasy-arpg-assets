v0.2 的独立生成原图位于 Source/Generated，提示词和实际记录位于 Documentation。旧抠图算法不能重建本次重绘；此包内该入口已禁用，历史脚本仍留在 v0.1 备份。

地牢/四方向试验工具：`python3 Tools/build_prototype_kit.py` 仅重建坐标和导入metadata；`python3 Tools/kit-tests/native_art.py` 核对生成记录哈希、透明边界与帧锚点；`npm run build:preview` 重建独立HTML；`npm run test:kit` 验证网页交互；`npm run test:godot` 使用真实Godot验证导入与状态，`GODOT_RENDER=1` 可另存渲染截图。它们都不改写源PNG。具体验收边界见 `Assets/NLI_Prototype_Kit/README.md` 与 `Prototypes/GodotImport/README.md`。
