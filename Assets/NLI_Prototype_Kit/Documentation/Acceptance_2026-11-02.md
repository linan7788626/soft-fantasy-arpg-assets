# 四方向动作与压力板小批量验收 · 2026-11-02

## 结果

技术验证通过，作为可交互美术试验交付；尚不是全部角色动作的生产定稿。本批没有扩大地牢规模，先完成四方向与机关状态的验证闭环。

新增4张原生PNG：`Hero_Walk_North_6.png`、`Hero_Walk_South_6.png`、`Hero_Walk_West_6.png`、`Pressure_Plate_Pressed.png`，位于本套件 `Sprites/`。向右6帧与原有8个模块继续复用，原有224项基础素材无改动。现有套件共13张PNG、24个行走帧、4个复用静帧的待机状态和压力板两状态。

工具为内置 `image_gen`。实际提示词、参考图、原始输出路径和SHA-256见同目录 `round2-generation.json`。所有交付图与生成输出字节一致，没有裁切、去底、缩放或重绘后处理。切帧仅通过清单、Canvas sourceRect 和 Godot AtlasTexture 发生在渲染中。

## 画面检查

- 四张角色图均为2172×724，每张识别到6个独立轮廓。逐帧矩形不互相重叠，头盔、鞋底和披风核心轮廓完整；源图未按等宽格硬切。
- 依据头盔水平中心和实际鞋底写入Pivot；源图鞋底高度波动为向右1px、向下6px、向左6px、向上2px，已通过渲染锚点校准。各方向在深色、浅色、棋盘背景上逐帧检查，证据见预览 Validation 的 `direction-*.png`。
- 盾牌在同一方向各帧中未出现换手；正面在画面右侧、背面在画面左侧。新图保持收剑行走，没有用水平翻转代替新朝向。角色腰间装饰和披风仍存在局部变化，尚未达到严格的逐帧模型一致性。
- 空白区域保持原生透明。向左源图最右边存在最大2/255的极淡抗锯齿尾迹，核心轮廓仍在画布内；没有为消除该尾迹改动原图。各图主体核心Alpha中位数253/255，沿用生成器输出，不宣称全主体均为255。
- 压力板按下图保留奶油石框、金角和蓝灰板面，增加青色内缘与下沉感。两图按清单矩形对齐显示；未修补源图纹理，细部裂纹存在差异。对照见 `pressure-states.png`。
- 行走图存在近似重复姿态，背向披风摆幅及循环接缝仍值得精修。待机是相应方向第2帧，不是独立呼吸循环。通过技术检查不等同于用户已认可本批步态。

## 网页验证

`npm run test:kit` 全部通过：13张图离线加载、只托管预览目录的独立加载、三种房间、逐帧与帧率、四方向真实按键选择、移动播放/停止静止/碰墙静止、平滑推箱及重复推箱拦截、箱子落定后激活压力板和开门、推离后复位关门、深浅棋盘背景。

原有门墙接合、门洞通行和三布局修复已回归通过；本批未更换合格的墙体、门框或地板原图。

入口：仓库根目录 `Prototypes/DungeonWalk/index.html`，内嵌全部13张原图，可离线单独打开。源文件为同目录 `index.template.html`、`preview.js` 与 `kit-data.js`，修改后用 `npm run build:preview` 重建。

报告：`Prototypes/DungeonWalk/Validation/` 下的 `report.json`、`standalone-report.json`、`feedback-report.json`、`directions-report.json`、`native-art-report.json`。

## 实际引擎验证

使用机器上已有的 Godot **4.7.2-stable (official)**，实际执行 Editor 资源导入和 macOS 原生窗口运行，OpenGL 4.1 Metal Compatibility / Apple M1 Max 渲染。没有将浏览器测试记作引擎结果。

`GODOT_RENDER=1 npm run test:godot` 通过：原生尺寸资源导入、24个AtlasTexture帧、四方向定时播放与静止、脚底节点对齐、碰墙静止、Tween推箱、重复推箱拦截、压力板激活/复位以及门贴图转换。

首次引擎运行的测试曾因Vector2单精度数值与0.01严格相等比较中断，改用近似比较后通过。最终报告及导入/运行日志、真实引擎截图位于 `Prototypes/GodotImport/Validation/`。

打开 `Prototypes/GodotImport/project.godot` 前先运行 `npm run build:godot`。`Art/` 为可重建的原图副本，`.godot/` 为引擎缓存，均不提交。此工程是矩形房间导入试验，未覆盖完整游戏、网页全部布局和遮挡策略。未安装/验证Unity Editor；Unity动画切帧和控制器验收仍未完成。

## 后续

先根据本批预览确定是否需要精修步态及披风/腰间细节，再做四方向专用推箱、攻击/受击、独立待机。之后扩充机关（开关、尖刺、桥等）与地牢模块。地板仍不是完整自动铺砖集，不能据本次矩形房间证明所有拼接场景已验收。
