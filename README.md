# MarkNote

![](https://img.shields.io/github/stars/cedar12/marknote)![](https://img.shields.io/github/forks/cedar12/marknote)![](https://img.shields.io/github/downloads/cedar12/marknote/total)[![Release](https://github.com/cedar12/marknote/actions/workflows/release.yml/badge.svg)](https://github.com/cedar12/marknote/actions/workflows/release.yml)

🎉一个简单的所见即所得的 Markdown 编辑器，适用于 Linux、macOS 和 Windows。

---

# 功能

- 比 electron系 体积更小、运行更快、更加安全
- 多窗口
- 多主题，支持自定义主题
- 支持 CommonMark 规范、GitHub 风格的 Markdown 规范
- 支持段落和内联样式快捷方式
- 文档字符和单词统计
- 支持从剪贴板粘贴图像和拖动外部图像进行插入
- Markdown 扩展，如数学表达式（KaTeX）和Mermaid图表
- 支持导出图像、HTML、PDF 和 Word（.docx）文档
- 支持图床[PicGO](https://molunerfinn.com/PicGo/)
- 本地草稿恢复，支持未命名文档和大文件的完整内容
- 整篇源码编辑、分屏预览、全文与工作区搜索，以及文件冲突差异查看

# 文件安全与草稿恢复

关闭文档提供保存、放弃和取消。退出应用或安装更新前，会检查全部编辑窗口；任一窗口取消、保存失败或仍在处理文档时，保留应用和当前内容。更新先下载，安装前再检查文档。

编辑后的内容会独立保存到此电脑的应用数据目录 `drafts` 子目录，不会替代原 Markdown 文件。重启后可恢复草稿、暂不恢复或确认丢弃；暂不恢复的草稿可通过“查看草稿”再次打开。恢复会打开未保存的副本，保留原文件和相对图片的来源路径。成功保存或明确放弃后清理当前草稿；失败时保留内容并提供重试。单个草稿最多 128 MiB，超过限制会提示先保存文件。

文件在磁盘上被其他应用或窗口修改时，会保留当前内容并暂停自动保存。提示栏可查看当前整篇内容与磁盘版本的差异，再选择重新加载、另存为或确认覆盖；确认后文件再次变化，保存仍会停止。差异窗口只读，超出比较预算时明确显示未比较部分，刷新失败可重试。打开文件、最近文件和文件夹项目使用同一套保护。

未命名文档可以直接粘贴或拖入图片，默认先存到本机应用数据目录。图片使用独立文件名，上传失败也会清理临时缓存。另存为到其他文档时，将实际使用的本地图片复制到目标旁的 `<文档名称>.assets` 文件夹并调整引用；原始图片保留。找不到附件时停止保存，当前文档和草稿仍保留。PicGo HTTP 和命令行上传必须返回有效的 HTTP(S) 图片地址，超过 30 秒会停止。

# 完整文档导出

HTML、PDF、Word 和图片导出均使用完整文档，包括大文件中所有分段及当前修改。未命名或尚未保存的文档也可直接导出。HTML 与 PDF 嵌入图片、Mermaid 图表和文档样式，公式使用原生 MathML；PDF 不再限制为前 100 页。导出失败会保留原文档，取消文件选择不产生文件。

# 查找替换与 Markdown 保真

编辑菜单的“查找替换”作用于当前所见即所得段；“全文搜索”（默认 Ctrl/Cmd+Shift+F）查找整篇 Markdown，包括所有分段。结果显示行列和原文片段，点击进入源码定位。单处及全部替换先预览、再确认，可一次源码撤销；结果最多显示 300 条，全部替换独立扫描最多 10000 处，超过限制请缩小查询。文档变化后旧结果暂停定位和替换；输入法组合输入期间不会触发查找导航。

搜索侧栏可切换“工作区”，递归查找已打开文件夹中的 `.md` 和 `.markdown` 文件，可取消、重试并显示跳过项目。最多扫描 2000 个文件、20000 个目录项目、单文件 4 MiB、累计读取 64 MiB、32 层目录，显示最多 300 条结果；跳过链接。工作区搜索只读，打开结果仍检查未保存修改与磁盘版本。浏览器预览中仅提供整篇文档搜索。

在“首选项 → 编辑器 → 编辑模式”中选择所见即所得、源码或分屏预览，编辑区不显示模式切换栏。选择会在本地记住，下次启动恢复，并同步其他编辑窗口；正在保存、导出、加载文档或输入法组合输入的窗口会等待操作结束后安全切换。保存或同步设置失败时可重试。源码显示完整文档，保存、草稿、导出和搜索均使用其内容；未修改时切回保留所见即所得撤销历史，修改源码后重置该历史，源码自身撤销仍可用。源码历史最多保留 100 次操作、8 MiB 变更记录；单次超出预算时保留内容并提示分次修改。分屏预览支持同步滚动，大文件只预览当前位置附近，并标明行范围。源码模式中的格式和段落菜单会提示切回所见即所得使用。

大文件在完整 Markdown 块之间分段，保留列表续段、引用、代码块、公式及 HTML 容器；各段共享全文引用链接定义，修改包含定义的段时仍保留这些定义。保存代码块时会选用足够长的围栏，避免代码中的反引号提前结束代码块。

大文件可切换全文或当前段的统计范围。最近访问的最多 8 段保留各自的撤销、重做、选区和滚动位置，缓存另有约 16 MiB 内容与历史预算；超出预算的段仍保留 Markdown 和位置，重新加载后不保留旧撤销记录。普通文字输入不重新扫描全部目录或代码块；未知语言代码超过 12,288 字符、已知语言代码超过 262,144 字符时使用纯文本显示。

文件夹支持刷新、读取失败重试、空目录提示，以及忽略大小写的已加载名称过滤。展开子目录后才纳入其中的项目。侧栏支持拖动和键盘调整宽度，图片设置提供路径选择、校验和保存反馈。

关闭编辑窗口时记住其宽高，下次启动或新建窗口恢复上次关闭窗口的尺寸。使用逻辑像素，屏幕变小后会调整至可用范围；最小化不会覆盖正常尺寸。侧栏显示或隐藏状态与用户选择的宽度也会保留；窄窗口临时收窄侧栏后，扩大窗口仍恢复原宽度。

# 界面

![marknote-light.png](https://cdn.jsdelivr.net/gh/cedar12/picgo@main/images/202310122323992.png)

![](https://cdn.jsdelivr.net/gh/cedar12/picgo@main/images/202310122323635.png)

[Markdown 完整示例预览](docs/marknote.jpg)

# 下载

[下载最新稳定版本](https://github.com/cedar12/marknote/releases/latest)，或在[全部版本](https://github.com/cedar12/marknote/releases)中选择预发布版本。按系统选择 Windows `.msi` / `.exe`、macOS 对应 Intel 或 Apple 芯片的 `.dmg`，以及 Linux `.deb` / `.AppImage`。请以发布页实际附件为准。

# 开发

## 环境要求

1. Node.js 22，启用 Corepack；项目固定使用 Yarn 4.9.2。
2. 当前 Rust stable，以及 [Tauri 平台依赖](https://v2.tauri.app/start/prerequisites/)。旧 Rust 工具链无法读取当前 lockfile。

```shell
git clone https://github.com/cedar12/marknote.git
```

```shell
cd marknote
corepack enable
yarn install --immutable
yarn tauri dev
```

回归检查：`yarn test:unit`、`yarn build`、`yarn test:browser`、`cargo test --locked --manifest-path src-tauri/Cargo.toml --no-default-features`。浏览器检查需要 Playwright 与 Chromium，可通过 `MARKNOTE_PLAYWRIGHT_PATH` 和 `MARKNOTE_BROWSER_PATH` 指定位置。PR 和分支推送运行前端、浏览器及原生检查；标签发布先通过同一套检查，再构建安装包。

# 快捷键

在“首选项 → 快捷键”中点击输入框并按下组合键，可自定义文件、编辑、格式、段落和视图操作。支持清除单项、恢复默认和冲突提示；点击“保存快捷键”后立即生效并同步到其他窗口，重启后保留配置。

# 数学块和 Mermaid 源码

选中数学块或 Mermaid 图表后，可使用右上角的代码按钮展开源码、复制按钮复制原始源码。两者的源码编辑区使用相同的代码主题和样式；空数学块可直接输入公式。

# 编辑器字体

在“首选项 → 编辑器”中选择系统默认、无衬线、衬线或等宽字体，也可输入电脑上已安装的字体名称并按 Enter。正文字号支持 12–32 px，提供实时预览和恢复默认。设置即时生效、自动保存并同步到其他窗口，不影响文档内容或撤销历史。未安装的字体回退到系统默认字体，代码保持等宽字体。

# 图片导出

通过“文件 → 导出 → 图片”设置 PNG 或 JPEG、文档宽度、1× / 2× 分辨率、背景和 JPEG 质量。默认 1× 优先保证速度，PNG 支持透明背景。导出会使用完整文档（包括大文件的所有分段）及所选编辑器字体；失败后可保留设置重试。

# Markdown 设置

在“首选项 → Markdown”中调整单个换行、链接识别、智能标点、HTML 解析、紧凑列表、无序列表标记，以及粘贴和复制时的 Markdown 转换。设置自动保存并同步到其他窗口。

解析选项用于新打开的文档、后续粘贴和加载的分段，不会重建当前文档或清除撤销历史。输出选项用于后续保存与复制；大文件中未编辑的分段继续保留原文。“粘贴纯文本”和“复制纯文本”继续使用纯文本。

# 主题

## 内置主题

### Light

![image.png](README.md.assets/20231016105324.image.png)

### Dark

![image.png](README.md.assets/20231016105421.image.png)

## 自定义主题

### 安装主题

打开“首选项 → 主题”，点击“安装主题文件”，选择 UTF-8 编码的 JSON 文件。安装完成后可在列表中选择应用。已安装的主题保存在应用数据目录的 `themes` 子目录（Windows 通常为 `%APPDATA%/com.github.marknote/themes`），原始文件会保留。

文件最大 1 MiB，必须包含下例全部字段。`label` 为 1–128 个字符的非空名称，不能包含控制字符；`value` 为 1–128 个 ASCII 字母、数字、短横线或下划线；`type` 为 `light` 或 `dark`。所有 14 项颜色均须为 `#RGB`、`#RRGGBB` 或 `#RRGGBBAA`。不接受额外字段。

主题 ID 忽略大小写去重；重复安装会提示错误。`light`、`dark` 为保留 ID。

~~~json
{
  "label": "My Light Theme",
  "value": "my-light",
  "type": "light",
  "style": {
    "primaryBackgroundColor": "#2e3a62",
    "primaryBackgroundColorHover": "#334789",
    "primaryBackgroundColorActive": "#1f294a",
    "primaryTextColor": "#74bcd4",
    "primaryTextColorHover": "#4fb8db",
    "primaryTextColorActive": "#1e9fca",
    "primaryBorderColor": "#52b5f9",
    "contentBackgroundColor": "#ffffff",
    "contentBackgroundColorActive": "#ececec",
    "contentBackgroundColorHover": "#ececec",
    "contentTextColor": "#3e3e3e",
    "contentTextColorActive": "#4e4e4e",
    "contentTextColorHover": "#c4c4c4",
    "contentBorderColor": "#babec1"
  }
}
~~~

### 卸载主题

在“首选项 → 主题”中，点击已安装主题下的“卸载”并确认。卸载正在使用的主题时，所有窗口将切换到同类型的内置主题。内置主题和随包主题不能卸载。取消安装或卸载不会产生变更；文件操作失败会显示可恢复的错误。

# 许可

[MIT](https://github.com/cedar12/marknote/blob/main/LICENSE)
