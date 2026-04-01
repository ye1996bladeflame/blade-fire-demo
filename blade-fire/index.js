import { createGrid, enableZoom, history, getClipboard, parseTransform, getMousePosition, createShape } from "./common/index.js";
import { circle } from "./tools/circle.js";
import { rect } from "./tools/rect.js";
import { triangle } from "./tools/triangle.js";
import { polygon } from "./tools/polygon.js";
import { text } from "./tools/text.js";
import { select } from "./tools/select.js";
import { freehand } from "./tools/freehand.js";
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


            enablePan(svg);

            let lastMousePos = { x: 0, y: 0 };
            const onMouseMove = (evt) => {
                lastMousePos = getMousePosition(svg, evt);
            };
            window.addEventListener("mousemove", onMouseMove);


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

                    // Calculate offset
                    const offsetX = lastMousePos.x - clipboard.centerX;
                    const offsetY = lastMousePos.y - clipboard.centerY;

                    const newElements = [];
                    const svgNS = "http://www.w3.org/2000/svg";

                    clipboard.elements.forEach(item => {
                        const newEl = document.createElementNS(svgNS, item.tagName);

                        // Copy attributes
                        Object.keys(item.attributes).forEach(key => {
                            newEl.setAttribute(key, item.attributes[key]);
                        });

                        if (item.innerHTML) {
                            newEl.innerHTML = item.innerHTML;
                        }

                        // Adjust position
                        const transform = newEl.getAttribute("transform") || "";
                        const tData = parseTransform(transform);

                        tData.tx += offsetX;
                        tData.ty += offsetY;

                        let tStr = `translate(${tData.tx}, ${tData.ty})`;
                        if (tData.rotate) {
                            tStr += ` rotate(${tData.rotate}, ${tData.cx}, ${tData.cy})`;
                        }
                        if (tData.sx !== 1 || tData.sy !== 1) {
                            tStr += ` scale(${tData.sx}, ${tData.sy})`;
                        }

                        newEl.setAttribute("transform", tStr);

                        svg.appendChild(newEl);
                        newElements.push(newEl);
                    });

                    // Add to history
                    history.push({
                        desc: '粘贴元素',
                        undo: () => {
                            newElements.forEach(el => {
                                if (el.parentNode) el.parentNode.removeChild(el);
                            });
                        },
                        redo: () => {
                            newElements.forEach(el => svg.appendChild(el));
                        }
                    });

                    e.preventDefault();
                }
            };
            window.addEventListener("keydown", onKeyDown);


            this.svg = svg;

            return {
                svg,
                destroy: () => {
                    window.removeEventListener("mousemove", onMouseMove);
                    window.removeEventListener("keydown", onKeyDown);
                    // Also clean up features if needed
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
        return polygon(this.svg);
    }
    static text() {
        return text(this.svg);
    }
    static freehand() {
        return freehand(this.svg, this.drawingLayer);
    }
    static select() {
        return select(this.drawingLayer || this.svg, (elements) => this.notifySelectionChange(elements));
    }
}

export { BladeFire };
