# BladeFire Demo

BladeFire 是一个轻量级的基于 SVG 的绘图库，用于在浏览器中创建和操作矢量图形。本项目是一个使用 Vue 3 + Vite 构建的演示应用。

## 个人邮箱
1193677504@qq.com

## 功能特性

- **SVG 画布**: 高性能的可缩放矢量图形渲染。
- **网格系统**: 可配置的背景网格，辅助图形对齐。
- **标尺与辅助线**: 内置标尺 (Ruler) 和十字准星 (Crosshair)，提供精确的尺寸参考。
- **缩放与平移**: 支持鼠标滚轮缩放和画布拖拽平移。
- **丰富的绘图工具**:
  - **选择 (Select)**: 选择、移动、缩放、旋转图形。
  - **圆形 (Circle)**: 快速绘制圆形。
  - **矩形 (Rect)**: 快速绘制矩形。
  - **三角形 (Triangle)**: 快速绘制三角形。
  - **多边形 (Polygon)**: 自定义绘制多边形。
- **历史记录**: 完整的撤销 (Undo) 和重做 (Redo) 支持。
- **剪贴板**: 支持图形的复制与粘贴。

## 安装与运行

本项目使用 Node.js 和 npm 进行管理。

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
```

## 使用指南

### 1. 初始化 BladeFire

在 Vue 组件中引入并初始化：

```javascript
import { BladeFire } from './blade-fire/index.js';

onMounted(() => {
    const instance = BladeFire.init({
        container: 'map-container', // 容器元素的 ID
        grid: true,                 // 启用网格
        gridSize: 40,               // 网格大小 (像素)
        zoom: true,                 // 启用缩放和平移
        ruler: true,                // 启用标尺 (可选)
        crosshair: true             // 启用十字准星 (可选)
    });
    
    // 组件销毁时清理资源
    onUnmounted(() => {
        if (instance && instance.destroy) {
            instance.destroy();
        }
    });
});
```

### 2. 切换工具

通过调用静态方法激活相应的工具。务必保存返回的清理函数，以便在切换工具时清理上一个工具的状态。

```javascript
let activeToolCleanup = null;

const selectTool = (toolName) => {
    // 清理当前工具
    if (activeToolCleanup) {
        activeToolCleanup();
        activeToolCleanup = null;
    }

    // 激活新工具
    if (BladeFire[toolName]) {
        activeToolCleanup = BladeFire[toolName]();
    }
};

// 示例：激活矩形工具
selectTool('rect');
```

### 3. 事件监听

监听选中图形的变化，用于更新 UI 属性面板。

```javascript
const selectionCleanup = BladeFire.onSelectionChange((info) => {
    console.log('选中图形信息:', info);
    // info 包含: { id, tagName, x, y, width, height, rotation }
});
```

监听历史记录变化：

```javascript
const historyCleanup = BladeFire.onHistoryChange((stack) => {
    console.log('历史记录栈:', stack);
});
```

### 4. 自定义样式与创建图形

你可以通过全局或特定工具的方式来自定义绘图时的样式，也可以通过代码直接向画布中添加图形。所有创建的图形默认都会分配一个唯一的 `uid`。

```javascript
// 1. 设置全局默认样式
BladeFire.setGlobalStyle({
    "stroke-width": "2"
});

// 2. 设置特定工具的样式（支持：circle, rect, triangle, polygon, text, freehand 等）
BladeFire.setToolStyle('rect', {
    fill: 'rgba(255, 0, 0, 0.5)',
    stroke: '#ff0000'
});

// 3. 通过代码直接创建图形并自动添加到画布
const customRect = BladeFire.createShape('rect', {
    x: 120,
    y: 120,
    width: 300,
    height: 300,
    // uid: 'custom-id', // 如果不传，会自动生成唯一 id
});
```

### 5. 画布状态与历史记录管理

在进行画板切换或清空操作时，你可以清理历史记录栈：

```javascript
// 清空历史记录栈，使新画布状态独立
BladeFire.clearHistory();
```

## 快捷键列表

| 快捷键 | 功能 |
|--------|------|
| `Ctrl + Z` | 撤销 (Undo) |
| `Ctrl + Shift + Z` / `Ctrl + Y` | 重做 (Redo) |
| `Ctrl + V` | 粘贴 (Paste) - 在鼠标位置粘贴 |
| `Delete` / `Backspace` | 删除选中图形 |

## 项目结构

```
blade-fire-demo/
├── blade-fire/             # BladeFire 核心库
│   ├── common/             # 通用工具 (History, Grid, Zoom 等)
│   ├── features/           # 功能模块 (Ruler, Crosshair)
│   ├── tools/              # 绘图工具实现 (Select, Rect, Polygon 等)
│   └── index.js            # 库入口文件
├── src/                    # Vue 演示应用
│   ├── App.vue             # 主应用组件 (UI 布局与逻辑)
│   └── main.js             # Vue 入口
├── package.json            # 项目依赖配置
└── README.md               # 项目说明文档
```

## 技术栈

- **Vue 3**: 用于构建用户界面。
- **Vite**: 快速的开发构建工具。
- **Ant Design Vue**: 提供美观的 UI 组件。
- **SVG**: 原生 DOM 操作实现图形渲染。
