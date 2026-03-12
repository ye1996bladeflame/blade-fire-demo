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

            // Always enable drag with middle mouse button
            enableDrag(svg);

            // Setup global key listeners for undo/redo
            window.addEventListener("keydown", (e) => {
                // Check if any input is active to avoid conflict
                if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;

                if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                    if (e.shiftKey) {
                         history.redo();
                         e.preventDefault();
                    } else {
                         // Check if polygon tool is active and drawing?
                         // Actually polygon tool will handle its own keydown if focused?
                         // Or we can let polygon tool intercept it?
                         // If polygon is drawing, we might want to prevent global undo.
                         // But for now, let's implement global undo.
                         // Polygon tool will need to check history.undoStack? No.
                         // Polygon tool specific undo (removing point) is different from global undo (removing shape).
                         // If polygon tool is active and drawing, we should probably PRIORITIZE it.
                         
                         // We can add a check if a tool is "capturing" input.
                         // But simpler is to let polygon tool add its own listener that stops propagation if it handles it.
                         // But polygon tool is just a function that returns a cleanup. It attaches listeners to SVG/Window.
                         // If polygon adds listener to window, it will run.
                         // If I add listener here, it also runs.
                         // Capture phase vs Bubble phase.
                         
                         history.undo();
                         e.preventDefault();
                    }
                } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
                    history.redo();
                    e.preventDefault();
                }
            });

            // Assign svg to the class instance (this refers to the class itself in a static method)
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
