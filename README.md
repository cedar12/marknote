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

# 界面

![marknote-light.png](https://cdn.jsdelivr.net/gh/cedar12/picgo@main/images/202310122323992.png)

![](https://cdn.jsdelivr.net/gh/cedar12/picgo@main/images/202310122323635.png)

# 下载

> 国内github下载慢、以下下载链接使用了 `gh-proxy` 代理

### Windows

[MarkNote_0.0.7_x64_en-US.msi](https://gh-proxy.com/https://github.com/cedar12/marknote/releases/download/v0.0.7/MarkNote_0.0.7_x64_en-US.msi)

### MacOS

英特尔芯片

[MarkNote_0.0.7_x64.dmg](https://gh-proxy.com/https://github.com/cedar12/marknote/releases/download/v0.0.7/MarkNote_0.0.7_x64.dmg)

苹果M系芯片

[MarkNote_0.0.7_aarch64.dmg](https://gh-proxy.com/https://github.com/cedar12/marknote/releases/download/v0.0.7/MarkNote_0.0.7_aarch64.dmg)

### Linux

[mark-note_0.0.7_amd64.deb](https://gh-proxy.com/https://github.com/cedar12/marknote/releases/download/v0.0.7/mark-note_0.0.7_amd64.deb)

[mark-note_0.0.7_amd64.AppImage](https://gh-proxy.com/https://github.com/cedar12/marknote/releases/download/v0.0.7/mark-note_0.0.7_amd64.AppImage)

# 开发

## 环境要求

1. `Node 18+`
2. `Rust 1.7+`

```shell
git clone https://github.com/cedar12/marknote.git
```

```shell
cd marknote
yarn
yarn tauri dev
```

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
