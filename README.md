# MarkNote

![](https://img.shields.io/github/stars/cedar12/marknote)![](https://img.shields.io/github/forks/cedar12/marknote)![](https://img.shields.io/github/downloads/cedar12/marknote/total)[![Release](https://github.com/cedar12/marknote/actions/workflows/release.yml/badge.svg)](https://github.com/cedar12/marknote/actions/workflows/release.yml)

🎉A simple `WYSIWYG` markdown editor, available for Linux, macOS and Windows.

---

# Features

- Multiple Window
- Multiple Themes
- Support CommonMark Spec, GitHub Flavored Markdown Spec
- Support paragraphs and inline style shortcuts
- Document Character and Word Statistics
- Supports pasting images from the clipboard and dragging external images for insertion
- Markdown extensions such as math expressions (KaTeX)
- [PicGO](https://molunerfinn.com/PicGo/)

# Preview

![marknote-light.png](https://cdn.jsdelivr.net/gh/cedar12/picgo@main/images/202310122323992.png)

![](https://cdn.jsdelivr.net/gh/cedar12/picgo@main/images/202310122323635.png)

# Download

### Windows

You can download the lastest `MarkNote_%version%_x64-setup.exe` or `MarkNote_%version%_x64-en-US.msi` from the [release page](https://github.com/cedar12/marknote/releases/latest)

### MacOS

You can download the lastest `MarkNote_%version%_x64.dmg` from the [release page](https://github.com/cedar12/marknote/releases/latest)

### Linux

You can download the lastest Mar`kNote_%version%_x64.AppImage` from the [release page](https://github.com/cedar12/marknote/releases/latest)

# Development

## Environment

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

# Theme

## Built-in Theme

### Light

![image.png](README.md.assets/20231016105324.image.png)

### Dark

![image.png](README.md.assets/20231016105421.image.png)

## Custom Theme

### Install Theme

Theme JSON Schema

```json
{
  "type": "object",
  "properties": {
	"label": {
	  "type":"string",
	  "title":"主题标签",
	},
	"value": {
	  "type":"string",
	  "title":"主题值",
	},
	"type": {
	  "type":"string",
	  "title": "主题类型",
	  "enum":["light","dark"]
	},
	"style": {
	  "type":"object",
	  "title": "主题样式",
	  "properties": {
		"primaryBackgroundColor": {
		  "type":"string",
		  "pattern":"^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$"
		},
		"primaryBackgroundColorHover": {
		  "type":"string",
		  "pattern":"^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$"
		},
		"primaryBackgroundColorActive": {
		  "type":"string",
		  "pattern":"^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$"
		},
		"contentBackgroundColor": {
		  "type":"string",
		  "pattern":"^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$"
		},
		"primaryTextColor": {
		  "type":"string",
		  "pattern":"^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$"
		},
		"primaryTextColorHover": {
		  "type":"string",
		  "pattern":"^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$"
		},
		"primaryTextColorActive": {
		  "type":"string",
		  "pattern":"^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$"
		},
		"contentTextColor": {
		  "type":"string",
		  "pattern":"^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$"
		},
		"primaryBorderColor": {
		  "type":"string",
		  "pattern":"^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$"
		},
		"contentBorderColor": {
		  "type":"string",
		  "pattern":"^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$"
		},
		"contentBackgroundColorActive": {
		  "type":"string",
		  "pattern":"^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$"
		},
		"contentBackgroundColorHover": {
		  "type":"string",
		  "pattern":"^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$"
		},
		"contentTextColorActive": {
		  "type":"string",
		  "pattern":"^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$"
		},
		"contentTextColorHover": {
		  "type":"string",
		  "pattern":"^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$"
		}
	  }
	}
  }
}
```

### Uninstall Theme

# License

[MIT](https://github.com/cedar12/marknote/blob/main/LICENSE)