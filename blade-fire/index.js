import { createGrid, enableZoom } from "./common/index.js";
import { line } from "./tools/line.js";
import { circle } from "./tools/circle.js";
import { rect } from "./tools/rect.js";
import { triangle } from "./tools/triangle.js";
import { polygon } from "./tools/polygon.js";
import { text } from "./tools/text.js";
import { image } from "./tools/image.js";

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

            return svg;
        }
    }

    static line = line;
    static circle = circle;
    static rect = rect;
    static triangle = triangle;
    static polygon = polygon;
    static text = text;
    static image = image;
}

export { BladeFire };