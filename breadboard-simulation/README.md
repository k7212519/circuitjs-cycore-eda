# CyCore Breadboard Simulation

面向 L1 学生实验的定制面包板编辑器。项目使用 React、TypeScript 和 Konva 绘制 1460 孔面包板，并通过同源 iframe 调用 CircuitJS 求解内核。

## 开发

要求 Node.js 20.19+ 与 pnpm 10。

```bash
pnpm install
VITE_DEV_AUTH_BYPASS=true pnpm dev
```

真实 CircuitJS 联调时，先在仓库根目录运行：

```bash
python3 -m http.server 8000 --directory site
```

Vite 会把 `/circuit-engine` 代理到该服务。`VITE_DEV_AUTH_BYPASS` 只在开发模式生效，并让 CircuitJS 使用已有的离线仿真入口。

本地 CircuitJS 页面（端口 `8000`）右上角的“实物仿真”入口会在新标签页打开
`http://<当前主机>:5174/circuit/breadboard/`。生产构建不使用开发端口，入口保持同源路径
`/circuit/breadboard/`。

开发环境中的登录与激活页面通过 `/circuit-engine/` 代理访问端口 `8000`，因此登录页、
面包板页面及登录后的回跳都保持在 Vite 的同一浏览器源下，不会被 Vite 的 public base 拦截。
从本地 CircuitJS 入口打开时，页面还会通过限定为 `8000 → 5174` 的一次性消息握手复用
已有 `eda_token`。没有 token、token 失效或开发后端暂时不可用时直接进入访客模式：元件搭建、
本地恢复草稿和 CircuitJS 求解仍可用，但云项目打开、保存及另存不可用。登录与面包板请求
统一走 Vite `/api` 代理。

## 画布操作

- 鼠标滚轮：以指针位置为中心缩放，范围为 25%–350%。
- 按住鼠标中键拖动：平移面包板视图。
- 鼠标左键拖动画布空白处：不平移，仅用于选择；元器件和引脚仍使用左键拖动。
- 横屏平板：保留双指缩放和平移。

## 构建与测试

### CD4017 模块

“芯片 → CD4017”采用固定 8×2 脚位，可跨 A–B、B–C、C–D 放置和整体移动，不支持旋转或单脚拖动。左下角是 1 脚；下排从左到右 1–8，上排从左到右 16–9。属性栏按实物脚号显示全部 16 路端口读数，电流正值表示流入元件。

上下排实际插孔间距为 92px，比原封装的 110px 缩小一个 18px 孔距；数码管封装不变。旧 CD4017 在载入或编辑时会尝试在相同电气节点内收紧一排引脚；若新孔位被占用，则保留原封装并显示提示，不会覆盖导线或其他元件。

- 16 脚 VDD 接 +5V，8 脚 VSS 接 GND；13 脚 INH、15 脚 RESET 接低电平。
- 14 脚 CLK 使用现有按键或开关输入；按键接 +5V 时，应外接下拉电阻（例如 10 kΩ）到 VSS，确保松开后恢复低电平。
- Q0–Q9 依次位于 3、2、4、7、10、1、5、6、9、11 脚；12 脚 CO 在 Q0–Q4 期间为高。LED 必须外接限流电阻。
- RESET 高电平优先复位；INH 高电平停止计数。供电不足 3V、断电或反接时输出高阻，重新供电从 Q0 开始；上电时已经为高的 CLK 不计为上升沿。

内核使用功能级教学近似：输出导通 20Ω、截止 10GΩ，VDD–VSS 静态负载 1MΩ；输入阈值为相对 VSS 的半供电电压。不模拟精确 CMOS 驱动曲线、传播延迟、损坏和输入保护二极管。控制规则参考 [TI CD4017B 官方资料](https://www.ti.com/product/CD4017B)。

含 CD4017 的电路中，按键/开关通过现有 `setExtVoltage` 接口控制 `AnalogSwitchElm`（触点导通 1mΩ、截止 10GΩ），不再因操作触点重新导入电路。未新增桥接 API，暂停/继续和视图操作也不会清空计数；改变接线或元件参数仍会重建仿真。无 CD4017 的旧电路保持原有 `SwitchElm` 映射。

模块修改后的完整构建命令（不含测试）：

```bash
gradle compileGwt makeSite
```

### 常规前端检查

```bash
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
```

`pnpm build` 输出到 `../war/breadboard/`。也可在 CircuitJS 根目录运行：

```bash
gradle breadboardBuild
gradle makeSite
```

后一个命令会将面包板产物一并复制到 `site/breadboard/`。

## 环境变量

- `VITE_PUBLIC_BASE`：生产资源基础路径，默认 `/circuit/breadboard/`。
- `VITE_API_BASE_URL`：后端 API 地址；生产默认 `https://api-eda.cycore.com.cn`。
- `VITE_CIRCUITJS_URL`：CircuitJS iframe 地址；生产默认 `/circuit/circuitjs.html`。
- `VITE_CIRCUITJS_DEV_ORIGIN`：开发 CircuitJS 静态服务，默认 `http://127.0.0.1:8000`。
- `VITE_API_DEV_ORIGIN`：开发后端代理地址。
- `VITE_DEV_AUTH_BYPASS=true`：仅开发环境跳过登录，用于本地 UI 调试。
- `VITE_DISABLE_ENGINE=true`：仅用于 UI 自动化测试时关闭 iframe。

## 后端准备

部署前执行 `cycore-eda-admin/sql/20260901_breadboard_project.sql`。接口位于 `/cycore/breadboard/projects`，由现有 L1 JWT 与产品访问拦截器保护。
