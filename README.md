# SmartProxy for Firefox

SmartProxy 是一款轻量级、现代化的 Firefox 浏览器代理管理扩展。它允许您轻松管理多个代理服务器，并基于灵活的规则引擎自动切换代理，同时提供直观的用户界面和深色/浅色主题支持。

![SmartProxy Icon](icons/icon-128.png)

## ✨ 主要功能

*   **多协议支持**：支持 HTTP, HTTPS, SOCKS4, SOCKS5 代理协议。
*   **智能规则引擎**：
    *   **通配符匹配**：如 `*.google.com/*`
    *   **正则表达式**：强大的正则匹配支持
    *   **域名匹配**：精确匹配特定域名
    *   **IP/CIDR**：支持 IP 范围匹配
    *   **优先级排序**：支持拖拽排序规则优先级
*   **多种代理模式**：
    *   **直接连接**：不使用任何代理
    *   **全局代理**：所有流量强制走指定代理
    *   **自动模式**：根据规则自动决定是否使用代理
    *   **PAC 模式**：通过 PAC 脚本控制
*   **现代化 UI**：
    *   内置深色和浅色主题，可随心切换。
    *   Popup 弹窗支持快速切换模式和测试当前页面 URL。
    *   右键菜单集成，支持快速添加当前网站规则。
*   **代理认证**：支持带用户名密码认证的代理服务器（自动处理认证请求）。
*   **配置管理**：支持 JSON 格式的配置导入与导出，方便备份和迁移。
*   **自动更新**：支持通过 Firefox Add-ons Store 自动更新，或通过 GitHub Releases 进行版本检查与更新。

## 📂 目录结构

```
SmartProxy/
├── manifest.json              # Firefox Manifest V3 配置文件
├── background/                # 后台脚本
│   ├── background.js          # 主入口
│   ├── proxy-handler.js       # 代理处理核心
│   ├── rule-engine.js         # 规则引擎
│   └── storage.js             # 存储管理
├── popup/                     # 弹出界面
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── options/                   # 设置页面
│   ├── options.html
│   ├── options.css
│   └── options.js
├── _locales/                  # 国际化语言包 (zh_CN, en)
├── icons/                     # 图标资源
└── lib/                       # 工具库
    └── utils.js
```

## � 安装指南

### 方法一：Firefox Add-ons Store 安装 (推荐)

> 至 Firefox Add-ons Store，直接搜索 "SmartProxy" 安装。

### 方法二：通过 GitHub Releases 安装 (支持自动更新)

1.  访问本项目的 [Releases 页面](https://github.com/id88/SmartProxy/releases)。
2.  下载最新版本的 `.xpi` 文件 (例如 `smartproxy.xpi`)。
3.  将下载的文件拖入 Firefox 浏览器窗口即可安装。
4.  **注意**：通过此方式安装的插件也会根据 `manifest.json` 中的配置自动检查 GitHub 上的新版本。

### 方法三：开发模式安装 (开发者)

如果您想参与开发或调试代码：

1.  克隆本项目代码到本地：
    ```bash
    git clone https://github.com/id88/SmartProxy.git
    ```
2.  打开 Firefox 浏览器，在地址栏输入 `about:debugging` 并回车。
3.  点击左侧菜单的 **"此 Firefox" (This Firefox)**。
4.  点击 **"临时载入附加组件..." (Load Temporary Add-on...)** 按钮。
5.  在文件选择对话框中，进入本项目目录，选择 `manifest.json` 文件。

## 📖 使用说明

### 1. 配置代理服务器
1.  点击工具栏上的 SmartProxy 图标，选择 **"设置" (Settings)** 图标进入设置页面。
2.  在 **"代理配置"** 标签页，点击 **"+ 添加代理"**。
3.  填写代理名称、类型（HTTP/SOCKS5等）、主机地址、端口。
4.  如果有用户名和密码，请在对应字段填写（密码会自动加密存储）。
5.  点击保存。

### 2. 添加规则
1.  **快速添加**：在浏览网页时，在页面空白处右键，选择 **"SmartProxy" -> "为此网站添加代理规则"**。
2.  **手动添加**：进入设置页面，切换到 **"规则列表"** 标签页。
    *   点击 **"+ 添加规则"**。
    *   输入匹配模式（例如 `*.example.com/*`）。
    *   选择规则类型（通常使用 "通配符"）。
    *   选择该规则使用的代理服务器（或选择 "直接连接"）。
    *   点击保存。
3.  **优先级**：在规则列表中，您可以拖拽规则行来调整优先级（上面的规则优先匹配）。

### 3. 切换模式
点击工具栏图标打开弹出窗口，点击顶部的按钮切换模式：
*   **直连**：流量不经过代理。
*   **全局**：所有流量经过选定的代理。
*   **自动**：根据规则列表匹配，匹配到的走对应代理/直连，未匹配的走"默认动作"（默认为直连，可在高级设置中修改）。
*   **PAC**：使用 PAC 脚本。

### 4. 主题切换
进入 **设置 -> 高级设置**，在 **"主题"** 选项中选择 "深色模式" 或 "浅色模式"。

## ⚠️ 注意事项

*   **权限说明**：本扩展申请了 `proxy` (控制代理), `webRequest` 和 `webRequestBlocking` (用于代理认证), `tabs` (获取当前页URL), `storage` (保存配置) 等权限。
*   **隐私安全**：所有代理密码均经过简单加密存储在本地 (`browser.storage.local`)，不会上传到任何服务器。
*   **兼容性**：基于 Firefox Manifest V3 开发，建议使用最新版 Firefox 浏览器。

## 🤝 贡献

欢迎提交 Issue 或 Pull Request 来改进这个项目！

## 📄 License

MIT License
