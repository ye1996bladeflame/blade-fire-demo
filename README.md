# BladeFire

BladeFire 是一个轻量级的基于 SVG 的绘图库，用于在浏览器中创建和操作矢量图形。

## 功能特性

- **SVG 画布**: 支持可缩放矢量图形。
- **网格系统**: 可选的背景网格，辅助对齐。
- **缩放与平移**: 内置画布缩放和平移功能。
- **形状工具**: 支持绘制圆形、矩形、三角形、多边形。
- **选择工具**: 支持选择、移动、调整大小和旋转形状。
- **历史记录**: 支持撤销（Undo）和重做（Redo）。

## 使用方法

### 1. 初始化

引入 `BladeFire` 并使用容器元素进行初始化。

```javascript
import { BladeFire } from './blade-fire/index.js';

BladeFire.init({
    container: 'map-container', // DOM 元素的 ID
    grid: true,                 // 启用网格
    gridSize: 20,               // 网格大小 (默认: 20)
    zoom: true                  // 启用缩放
});
```

### 2. 激活工具

调用相应的静态方法来激活工具。每个工具方法都会返回一个清理函数，用于停用该工具。

```javascript
// 激活圆形工具
const cleanupCircle = BladeFire.circle();

// 之后，调用清理函数以停用工具:
cleanupCircle();

// 激活矩形工具
const cleanupRect = BladeFire.rect();
```

### 3. 可用工具

| 工具 | 方法 | 描述 |
|------|--------|-------------|
| **选择 (Select)** | `BladeFire.select()` | 选择、移动、调整大小和旋转形状。支持多选。 |
| **圆形 (Circle)** | `BladeFire.circle()` | 点击并拖动以绘制圆形。 |
| **矩形 (Rect)** | `BladeFire.rect()` | 点击并拖动以绘制矩形。 |
| **三角形 (Triangle)** | `BladeFire.triangle()` | 点击并拖动以绘制三角形。 |
| **多边形 (Polygon)** | `BladeFire.polygon()` | 点击添加顶点，双击或点击起始点完成绘制。 |
| **文本 (Text)** | `BladeFire.text()` | 点击添加文本，双击现有文本进行编辑。 |

## 快捷键

- **撤销**: `Ctrl + Z`
- **重做**: `Ctrl + Shift + Z` 或 `Ctrl + Y`

## 项目结构

- `blade-fire/`: 核心库文件。
  - `common/`: 共享工具（网格、历史记录、缩放等）。
  - `tools/`: 工具实现（圆形、矩形、选择等）。
  - `index.js`: 主入口文件。
- `src/`: 使用 BladeFire 的 Vue 演示应用。
