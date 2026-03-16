import { createGrid, enableZoom, history, getClipboard, parseTransform, getMousePosition } from "./common/index.js";
import { circle } from "./tools/circle.js";
import { rect } from "./tools/rect.js";
import { triangle } from "./tools/triangle.js";
import { polygon } from "./tools/polygon.js";
import { text } from "./tools/text.js";
import { select } from "./tools/select.js";
import { enableDrag } from "./tools/drag.js";

class BladeFire {
    version = "1.0.0";
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

            
            enableDrag(svg);

            let lastMousePos = { x: 0, y: 0 };
            window.addEventListener("mousemove", (evt) => {
                 lastMousePos = getMousePosition(svg, evt);
            });
            
            
            window.addEventListener("keydown", (e) => {
                
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
            });

            
            this.svg = svg;

            return svg;
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
    static select() {
        return select(this.svg);
    }
}

export { BladeFire };
