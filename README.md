# Cookie 管家（Cookie Picker）

一个 Chrome 扩展，**读取任意已登录网站的完整 Cookie（含 httpOnly），无需手动去 DevTools 复制 Cookie 请求头**。

> **跨平台，无需单独 Mac 版**：本扩展是浏览器扩展（MV3），与操作系统无关。Windows / macOS / Linux 的 Chrome、Edge 通用，**同一个 zip 即可**。下文 Windows 与 macOS 的安装步骤基本一致，仅文件夹选择对话框略有不同。

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

## 关于「NAS 推送」——与取 Cookie 无关，但代码完整保留

代码里有一块「推送到 NAS」（`http://<IP>:8899/api/set-cookies`）和「写入本地目录」的逻辑。

**那是我对接自己其他项目的可选集成，和「读取网站 Cookie」这个核心功能没有任何关系。** 这段功能**完整保留在扩展里、一直在**，不是被删掉的：只要在「设置」里填好 NAS IP 并点「测试」通过，读取后就会自动把 Cookie 推过去，读取后也会显示「导出到 NAS」按钮，可手动再推一次。

不填 IP、不配置，它就完全不触发，你照样能用「读取 + 复制」取 Cookie。扩展默认不会自动上传任何数据，Cookie 只在你本机处理。

> 一句话：NAS 推送是「可选开关」，不是「被砍掉的功能」。你之前那个能成功推送的版本，代码原样都在。

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

## 在 macOS 上安装（与 Windows 同一份文件）

Mac 用户**下载同一个 `cookie-picker-v1.2.3.zip` 即可**，不需要单独的 Mac 版。

1. 下载 release 里的 `cookie-picker-v1.2.3.zip`，双击解压（或用终端 `unzip`），得到 `cookie-picker-v1.2.3/` 文件夹（里面直接是 `manifest.json`、`popup.html` 等，**不要再多嵌套一层**）。
2. 打开 Chrome，地址栏输入 `chrome://extensions/` 并回车。
3. 右上角打开「开发者模式」（Developer mode）。
4. 点「加载已解压的扩展程序」（Load unpacked），在弹出的 macOS 文件夹选择框里**选中解压出的 `cookie-picker-v1.2.3` 文件夹**（不是里面的某个文件）。
5. 工具栏出现橙色图标即成功。

> **Mac 专属小坑**：若从「下载」目录直接加载报错（macOS 偶尔会因 quarantine 拦截刚下载的文件夹），把 `cookie-picker-v1.2.3` 文件夹拖到别处（如 `~/Documents`）再加载即可。终端里也可执行 `xattr -cr /path/to/cookie-picker-v1.2.3` 清除隔离属性。

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

Socials: @下一站澳门. DM for inquiries.
