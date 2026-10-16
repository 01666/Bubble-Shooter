# 1.8.0 独立工程

本目录是唯一维护与运行入口，规则与画面等同用户认可的1.7.3。Node.js22+，运行`node tools/server.mjs`，打开http://127.0.0.1:4210/；图片、字体、音频及Babylon全部本地提供。正式入口src/client/app.mjs，dev只是隔离预览。

完整规格：../docs/37-1.8.0完整产品规格与决策记录.md；结构、修改入口、检查和发布：../docs/38-1.8.0工程结构与封版验收.md。核心、场景和反馈各自分层，摇奖分出计划/实时目标/结算/校验；渲染不能直接发奖。

开发安装npm ci；npm run check、npm test、npm run test:slots。npm run test:baseline对照项目output/refactor-baseline/v1.7.3/game，独立包可显式提供旧基线路径；运行游戏不需要历史基线。运行代码格式检查：node node_modules/prettier/bin/prettier.cjs --check src。npm run audit生成版本盘点；node tools/check-release.mjs 1.8.0检查冻结哈希。

存档键和配置身份保留，不清盘、不清余球和待出票。真硬件、Android封装、中央服务及商业数值未完成；试玩投币/出票为模拟。
