# Cookie 管家（Cookie Picker）

一个 Chrome 扩展，**读取任意已登录网站的完整 Cookie（含 httpOnly），无需手动去 DevTools 复制 Cookie 请求头**。

## 为什么要做它

手动取 Cookie 有两个痛点：

1. 去 DevTools → Network → 复制整行 `Cookie:` 请求头，又长又容易漏；
2. 页面里的 `document.cookie` **拿不到 httpOnly 项**（而登录态往往偏偏在 httpOnly 的 `SUB`/`SUBP` 之类字段里）。

本扩展在 Chrome 进程内直接调用 `chrome.cookies` API，能拿到该域名下的**全部** Cookie（含 httpOnly），一键转成可用的字符串或 JSON。

## 核心功能

- **多站点管理**：默认带「雪球」「微博」，可任意添加域名（如 `zhihu.com`、`weibo.com`、`xueqiu.com`）。
- **每站一键读取**：点「测试读取」即调 `chrome.cookies.getAll`，显示「✓ N 条 / ✗ 无 Cookie」。
- **复制到剪贴板**：一键把结果拼成 JSON 复制，直接粘到需要 Cookie 的脚本里。

> 以上三步就是它的**全部核心用途**：取你本地已登录网站的 Cookie。

## 关于「NAS 推送」——与取 Cookie 无关

代码里有一块「推送到 NAS」（`http://<IP>:8899/api/set-cookies`）和「写入本地目录」的逻辑。

**那是我对接自己其他项目的可选集成，和「读取网站 Cookie」这个核心功能没有任何关系。** 你完全可以只用「读取 + 复制」功能，完全不配置 NAS、不填 IP——这部分代码删掉也不影响取 Cookie。扩展默认不会自动上传任何数据，Cookie 只在你本机处理。

如果你只想用取 Cookie，忽略设置面板里的 NAS IP 即可。

## 安装

1. 打开 `chrome://extensions/`
2. 右上角打开「开发者模式」
3. 点「加载已解压的扩展程序」，选择本目录（`cookie-picker/`）
4. 工具栏出现橙色图标即成功

## 使用

1. 确保你已在目标网站（如 `weibo.com`）**登录**
2. 点工具栏图标打开弹窗
3. 在站点列表勾选目标站，点「测试读取」
4. 看到「✓ N 条」后，点「复制」拿 JSON

## 权限说明

- `cookies` + `<all_urls>`：用于读取任意网站的 Cookie（按域名过滤，不会乱读）。
- `storage`：记住你的站点配置。
- `clipboardWrite`：复制到剪贴板。

## 文件结构

```
cookie-picker/
├── manifest.json   # MV3 清单
├── popup.html      # 弹窗界面
├── popup.js        # 核心逻辑（chrome.cookies API）
└── icon*.png       # 图标
```
