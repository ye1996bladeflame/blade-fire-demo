import { createGrid, enableZoom, history, getClipboard, getMousePosition, createShape, setToolStyle, setGlobalStyle, createListenerManager, pasteFromClipboard } from "./common/index.js";
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
            // history.push({
            //     desc: '新增自定义图形',
            //     undo: () => shape.remove(),
            //     redo: () => this.svg.appendChild(shape)
            // });
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
                        history.redo();
                        e.preventDefault();
                    } else {
                        history.undo();
                        e.preventDefault();
                    }
                } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
                    history.redo();
                    e.preventDefault();
                } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
                    const clipboard = getClipboard();
                    if (!clipboard || !clipboard.elements.length) return;

                    const offsetX = lastMousePos.x - clipboard.centerX;
                    const offsetY = lastMousePos.y - clipboard.centerY;

                    pasteFromClipboard(svg, clipboard, offsetX, offsetY);
                    history.commit('粘贴元素');

                    e.preventDefault();
                }
            };
            listeners.on(window, "keydown", onKeyDown);


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
