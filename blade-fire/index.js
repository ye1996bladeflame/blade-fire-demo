import { createGrid, enableZoom, history } from "./common/index.js";
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
