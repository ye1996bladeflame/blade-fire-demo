import { createGrid, enableZoom, history, undoRedoManager, getClipboard, getMousePosition, createShape, setToolStyle, setGlobalStyle, createListenerManager, pasteFromClipboard } from "./common/index.js";
import { circle } from "./tools/circle.js";
import { rect } from "./tools/rect.js";
import { triangle } from "./tools/triangle.js";
import { polygon } from "./tools/polygon.js";
import { text } from "./tools/text.js";
import { select } from "./tools/select.js";
import { freehand } from "./tools/freehand.js";
import { erase } from "./tools/erase.js";
import { enablePan } from "./features/pan.js";
import { createRuler } from "./features/ruler.js";
import { createCrosshair } from "./features/crosshair.js";

class BladeFire {
    version = "1.0.0";
    static selectionListeners = [];

    static onSelectionChange(callback) {
        this.selectionListeners.push(callback);
        return () => {
            this.selectionListeners = this.selectionListeners.filter(cb => cb !== callback);
        };
    }

    static onHistoryChange(callback) {
        return history.subscribe(callback);
    }

    /**
     * 注册 undo/redo 恢复后的工具切换回调。
     * 当撤销/重做恢复一个图形时，会通知 UI 切换到 select 工具以显示选中状态。
     */
    static onUndoRedoRestore(callback) {
        undoRedoManager.setToolChangeCallback(callback);
        return () => undoRedoManager.setToolChangeCallback(null);
    }

    static clearHistory() {
        history.clear();
    }

    static setToolStyle(toolName, style) {
        setToolStyle(toolName, style);
    }

    static setGlobalStyle(style) {
        setGlobalStyle(style);
    }

    static createShape(tag, attrs) {
        const shape = createShape(tag, attrs);
        if (this.svg) {
            this.svg.appendChild(shape);
            // 程序化导入的元素作为"原始数据"写入历史基线：
            // 之后对它的移动/缩放/旋转，撤销时只回退变换，不会把元素本身删掉。
            if (tag === 'image' && (attrs?.href || attrs?.src)) {
                // 图片需要等加载 + 居中（异步）完成后再同步，否则基线缺少最终坐标
                shape.addEventListener('blade-shape-ready', () => history.syncBaseline(), { once: true });
            } else {
                history.syncBaseline();
            }
        } else {
            console.warn("BladeFire is not initialized");
        }
        return shape;
    }

    static notifySelectionChange(elements) {
        this.selectionListeners.forEach(cb => cb(elements));
    }

    static init(config) {
        const container = document.getElementById(config.container);
        if (container) {
            const svgNS = "http://www.w3.org/2000/svg";
            const svg = document.createElementNS(svgNS, "svg");
            svg.setAttribute("width", "100%");
            svg.setAttribute("height", "100%");
            container.appendChild(svg);

            if (config.grid) {
                const gridSize = config.gridSize || 20;
                createGrid(svg, container.offsetWidth, container.offsetHeight, gridSize);
            }

            if (config.zoom) {
                enableZoom(svg);
            }

            // Initialize features
            this.ruler = createRuler(container, svg);
            if (config.ruler) {
                this.ruler.enable();
            }

            this.crosshair = createCrosshair(container);
            if (config.crosshair) {
                this.crosshair.enable();
            }


            const disablePan = enablePan(svg);

            const listeners = createListenerManager();

            let lastMousePos = { x: 0, y: 0 };
            const onMouseMove = (evt) => {
                lastMousePos = getMousePosition(svg, evt);
            };
            listeners.on(window, "mousemove", onMouseMove);


            const onKeyDown = (e) => {

                if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;

                if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                    if (e.shiftKey) {
                        undoRedoManager.redo(this.svg);
                        e.preventDefault();
                    } else {
                        undoRedoManager.undo(this.svg);
                        e.preventDefault();
                    }
                } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
                    undoRedoManager.redo(this.svg);
                    e.preventDefault();
                } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
                    const clipboard = getClipboard();
                    if (!clipboard || !clipboard.elements.length) return;

                    const offsetX = lastMousePos.x - clipboard.centerX;
                    const offsetY = lastMousePos.y - clipboard.centerY;

                    pasteFromClipboard(svg, clipboard, offsetX, offsetY);
                    history.commit('粘贴元素', { shapeType: 'paste' });

                    e.preventDefault();
                }
            };
            listeners.on(window, "keydown", onKeyDown);

            // 统一的 undo/redo 恢复回调
            undoRedoManager.setSelectionCallback((elements) => this.notifySelectionChange(elements));
            history.onRestore((cmd) => undoRedoManager.onRestore(cmd, this.svg));


            this.svg = svg;
            history.bind(svg);

            return {
                svg,
                destroy: () => {
                    listeners.dispose();
                    disablePan?.();
                }
            };
        }
    }
    static toggleRuler(enable) {
        if (this.ruler) {
            enable ? this.ruler.enable() : this.ruler.disable();
        }
    }
    static toggleCrosshair(enable) {
        if (this.crosshair) {
            enable ? this.crosshair.enable() : this.crosshair.disable();
        }
    }
    static circle() {
        return circle(this.svg);
    }
    static rect() {
        return rect(this.svg);
    }
    static triangle() {
        return triangle(this.svg);
    }
    static polygon() {
        return polygon(this.svg, (elements) => this.notifySelectionChange(elements));
    }
    static text() {
        return text(this.svg);
    }
    static freehand() {
        return freehand(this.svg, this.drawingLayer);
    }
    static erase() {
        return erase(this.svg);
    }
    static select() {
        return select(this.drawingLayer || this.svg, (elements) => this.notifySelectionChange(elements));
    }
}

export { BladeFire };
