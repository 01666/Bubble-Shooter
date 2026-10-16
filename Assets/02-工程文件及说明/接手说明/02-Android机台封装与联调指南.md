# Android机台封装与联调指南

日期2026-10-14。目标：将认可的1.8.0离线游戏装在安卓板卡，接摇杆/按键、投币器、彩票机并现场调试。

## 一、支持版本和未验证范围

**建议项目最低Android10/API29（minSdk29），新采购板卡优先Android12及以上。两者是本次工程建议，不是现有APK的已测支持声明。当前没有Android壳工程、APK或真实板卡测试结果。** Android版本并不足以保证兼容，决定本项目现代JS/WebGL能力的是设备WebView实现与GPU驱动。

必须提供可维护的Android System WebView/Chrome内核，记录确切版本与供应商。不要用多年不更新的固化内核，仅凭Android12标识认定能跑。检查ES Modules、structuredClone、Array.prototype.at、Web Audio、crypto.getRandomValues/randomUUID、Canvas及Babylon所用WebGL能力。以WebGL2为优先验收路径，必须实测驱动、纹理、混合、着色器和上下文恢复；不把软件渲染当正常性能。WebGL1回退能否满足当前材质亦需验证，不承诺仅改开关就等价。

初期硬件预算建议4GB以上内存、64位ARM、硬件GPU、可更新WebView，先按实际竖屏分辨率验证，不把4GB等同60FPS保证。目标60FPS，确实达不到时先降渲染分辨率、DPR、粒子和辉光并比较30FPS稳定档，不能削减账务正确性。板卡型号、GPU、屏幕、WebView版本和外设协议目前未知，由接手人与设备方补齐。

Android SDK compileSdk/targetSdk与AndroidX WebKit版本由程序员按接手时官方稳定版本和发布渠道要求锁定；不要把minSdk当targetSdk。公司直装APK与应用商店发布要求分别确认。调试签名与生产签名分开，固定applicationId和正式签名以保留升级数据。

## 二、推荐封装方案

先做Kotlin/Java单Activity原生壳+WebView，全部资源打入APK，使用AndroidX WebViewAssetLoader映射本地文件为固定HTTPS origin。无需先改Unity/Godot、无需在板卡跑Node、无需常联网。后续网络只服务于明确增加的配置/遥测等功能。

官方建议本地内容使用WebViewAssetLoader/合适的base URL，而不是file://和data://；这些来源会影响fetch等Web能力：[Android本地内容说明](https://developer.android.com/develop/ui/views/layout/webapps/load-local-content)、[WebViewAssetLoader API](https://developer.android.com/reference/androidx/webkit/WebViewAssetLoader)。

**本工程含根绝对路径**：index.html引用/vendor，app及场景引用/assets。不能直接把页面塞到/assets/game/index.html而不改映射，否则相对模块可能正常但图片/引擎404。推荐将下列内容复制到Android app/src/main/assets根目录：index.html、style.css、src/、assets/、vendor/。形成assets/index.html与assets/assets/images这种目录是有意的，后者对应网页/assets/images。

WebViewAssetLoader以“/”映射AssetsPathHandler，入口https://appassets.androidplatform.net/index.html；这让/vendor、/assets、相对src和字体地址都落到同一离线根。另一可行方式是统一改成带基路径的资源寻址，但须另做全部资源/画面对照，不能只改一个script。

下例只是壳实现方向，不是已经构建过的Android工程：

```kotlin
val loader = WebViewAssetLoader.Builder()
    .addPathHandler("/", WebViewAssetLoader.AssetsPathHandler(this))
    .build()
webView.settings.javaScriptEnabled = true
webView.settings.domStorageEnabled = true
webView.settings.allowFileAccess = false
webView.settings.allowContentAccess = false
webView.webViewClient = object : WebViewClient() {
    override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
        val response = loader.shouldInterceptRequest(request.url)
        if (request.url.path?.endsWith(".mjs") == true) {
            response?.mimeType = "text/javascript"
            response?.encoding = "UTF-8"
        }
        return response
    }
}
webView.loadUrl("https://appassets.androidplatform.net/index.html")
```

导入类、Activity、Gradle依赖、Manifest、生命周期、禁止外域导航和内部404处理需程序员补齐。HTML/CSS/JS模块/JSON/WAV/MP3/OGG/TTF/PNG各有正确MIME；尤其.mjs不能依赖每个ROM都能猜对。对该虚拟host仅返回包内白名单资源，找不到应返回明确404而非悄悄上网回退。限制顶层导航为自有固定origin；署名外链可交外部浏览器处理，不让含硬件桥的WebView加载陌生页面。

原公网的http-compat.js只解决IP HTTP下randomUUID，离线虚拟HTTPS先确认API可用，不需要把HTTP站点当APK入口。生产WebView硬件加速开启，混合内容保持拒绝；调试包可Chrome远程调试，正式包关闭。参考[WebView开发说明](https://developer.android.com/develop/ui/views/layout/webapps/webview)。

## 三、机台显示、输入与声音

- Activity竖屏9:16、沉浸全屏隐藏系统导航，屏幕常亮。外接屏/触摸屏实际尺寸不同，留安全区域，验证炮台、顶栏、宠物和宝箱不裁切。禁止用拉伸破坏逻辑比例。
- 第一阶段USB HID键盘/摇杆优先复用现有左右、空格、C映射。检查WebView获得焦点、按键repeat/up/down、摇杆死区，Back/系统按键不能无意退出游戏；仍需可授权的维修退出入口。
- 若Android消费了DPAD/按钮事件，由原生把统一输入投递给游戏输入队列，不能另写一套物理/奖励规则。一个物理按键不得同时原生映射和Web DOM触发造成双发。串口投币绝不能映射成可随意伪造的键盘C后直接上线。
- 游戏当前没有触摸/鼠标瞄准；此次封装保持原交互。调试投币按钮、自动瞄准、test=1、卡票模拟等入口在生产机移到受控维护工具或禁用，不能向普通玩家开放。
- Web Audio要实际启动。HID/原生事件未必等价浏览器可信用户激活；机台可评估mediaPlaybackRequiresUserGesture设置，并在设备启动流程验证AudioContext.resume结果。不要为了“有声音”不断new AudioContext或重复播BGM。失焦、暂停、系统弹窗、重建和重启后检查只保留1个音乐实例、3个同步层。

## 四、生命周期和离线资源

前后台切换/屏幕灭亮/暂停停止玩法计时，恢复不追算离线六秒窗口。当前JavaScript依赖focus/visibility和dt=0，不保证所有定制ROM发送同样事件；原生onPause/onResume应与页面暂停接口协同并实测。固定origin/applicationId，升级不能清WebView数据。

renderer被系统杀死/WebGL context lost时，保存状态、重建WebView/图形并恢复在途球、开奖计划与待出票，不把白屏当新游戏。渲染器重启不能再投币、再抽奖、再支付；轮转锁屏和低内存要单独测试。资源离线包记录版本及哈希，断网也能开机、玩游戏、解码字体和女声。

## 五、原生桥和真实设备接口

本版本只有模拟器；以下是建议协议，不是已实装的硬件驱动。先明确USB串口/RS232/RS485/GPIO/厂商SDK、电平、波特率、校验、帧格式、计数器、掉线重连和独立供电，再实现驱动。禁止假定彩票机每个脉冲都是可幂等确认的纸张。

核心现有调用入口：game.coin({receiptId, coins})、prepareDispense()、sendDispense(batchId)、confirmDispense({batchId,evidenceId,observedTotal})、markDispenseUncertain(batchId)。client/app目前创建SimulatedDispenser，替换为真实适配器，不改ledger基础协议。

建议桥消息统一envelope {protocolVersion, deviceId, bootId, messageId, type, payload}，严格类型/长度验证，所有命令应答关联messageId。仅允许固定自有origin；原生桥不要暴露任意shell、文件读取或任意URL能力。官方提示addJavascriptInterface等原生桥须限制内容来源和权限：[原生桥安全说明](https://developer.android.com/privacy-and-security/risks/insecure-webview-native-bridges)。

| 方向/消息 | 必要数据 | 语义 |
| --- | --- | --- |
| 原生→游戏coinAccepted | deviceId、耐久receiptId、coins | 同回执只加一次球；ID不能每重启从0复用 |
| 游戏→原生dispenseRequest | batchId、requested=1 | 原生先耐久记命令再发设备，不重复发送未决命令 |
| 原生→游戏dispenseObserved | batchId、唯一evidenceId、该批observedTotal | 只在物理成功证据后减待出彩票；重复证据幂等 |
| 原生→游戏fault | 设备状态与可恢复原因 | 缺票/卡票保留全部义务，能否继续投币由产品决定 |
| 游戏↔原生reconcile | 未决批次及设备耐久证据 | 不确定时查询/人工核对，不超时盲重发 |
| 原生→游戏input | 逻辑按键与按下/抬起 | 统一输入队列，避免重入结算 |

以上envelope和消息名是交接建议；程序员需要与厂家协议落实，不可声称按这些名字就能接任意彩票机。硬件事件进入主调度队列，避免从桥回调重入游戏事务。

## 六、存档与断电正确性——上真机前必须做

BrowserJsonStore是localStorage best-effort，不具备机台级断电保证。SQLite/厂商耐久存储作为原生权威层，至少保存完整机器快照、设备命令日志和物理回执；只有耐久提交成功才确认投币/中奖/发送动作的结果。

现有Store.load/save是同步接口，核心在save成功后发布事件。不能将save替换成“异步发消息然后立即返回成功”。若用桥同步返回，原生需在返回前确实提交事务并评估卡顿；或重构为显式异步事务/输入冻结，待持久化确认后再提交事件。首个离线演示APK可暂保留localStorage，但有真实币票时不能省掉这一步。

机器快照保留schema、配置、revision、全部RNG、盘面与库存、在途球、固定开奖计划/排队资格、六秒剩余时间、三星奖量、票账、赠球与回执去重。设备日志独立核对，不使用动画结束当出票证据。断电恰好发生于命令发出/纸出/回执保存之间时，没有设备耐久计数或可靠查询能力就标记不确定、人工核对，不能保证软件独力判断物理纸是否已出。

备份/恢复需绑定设备身份，防止把旧备份恢复到出票器造成重复支付；Android自动备份策略由工程方显式设置，避免跨设备自动复制设备义务。换源地址、清缓存和重装是否保留余额应提前定义。升级固定签名与appId，迁移先验证再接收新币。

## 七、程序员分阶段交付

1. 桌面复现1.8.0、通过现有测试，对照公网确认输入/盘面/声画。
2. Android离线调试APK：资源/MIME全通过、摇杆输入、音频、暂停恢复和性能；记录设备/内核版本。
3. 原生耐久层与设备模拟适配：故障注入、断电、重复回执和完整账务恢复通过后才接真币票。
4. 真投币器/彩票机：逐条协议联调、稳定计数、不确定核对与操作员界面；关闭玩家可达调试入口。
5. 长稳、温升、内存、升级回退、断网/杀进程/断电测试后生成正式签名APK与安装步骤。

Android壳建立后通常用Gradle assembleDebug/assembleRelease，但本包没有settings.gradle、Activity或Gradle Wrapper，因为还没有Android项目。程序员选择模板与锁定依赖后提交这些源文件、版本和签名保管方案，不能只交一个APK。

## 八、最低验收表

| 检查 | 通过标准 |
| --- | --- |
| 完全断网冷启动 | 所有图像/字体/脚本/声音可加载，无CDN依赖 |
| 输入 | 左右微调/长按/抬起正确，一按一发，不吞键不双发 |
| 连消与开奖 | 六秒/临界出手/暂停不跑时，边摇边打，六奖项实际一次到账 |
| 连锁与补球 | 中上特殊球分散、自然波次、全消一次完整恢复，无显著闪烁 |
| 声画 | BGM不叠、两女声可解码、+1同步、最高奖效时无长期卡顿 |
| 账务 | 同投币/奖励/确认ID重放不重复；未出票义务不丢 |
| 中断 | 在途/摇奖/出票发送及确认边界杀进程断电，恢复可解释可核对 |
| 连续运行 | 建议至少24小时混合自动测试+真实操作，记录FPS分位、最长卡顿、内存/温升、GC、WebGL丢失、设备断连 |
| 升级 | 原签名升级保留存档；旧快照迁移、异常回退流程演练 |

建议性能门槛如目标60FPS、最低稳定30FPS只是待板卡验证指标，不是当前承诺。生产返奖率/每币平均票量/高额波动仍为后续数值项目，不因APK封装完成自动获得商业数值认证。

## 九、请设备方补齐的信息

板卡品牌型号/Android API/GPU/WebView完整版本与升级途径；RAM/储存；屏幕分辨率/刷新率/竖屏方式；摇杆与按钮映射；投币/彩票机型号与原始协议；纸张传感器和耐久计数能力；掉电供电关系；维护入口；渠道与签名负责人。未拿到这些信息也可先做离线壳和桌面复现，但不能确认最终最低板卡或物理出票安全。
