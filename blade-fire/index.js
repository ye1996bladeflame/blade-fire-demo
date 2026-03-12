import { createGrid, enableZoom } from "./common/index.js";
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

    static line() {
        console.log("Draw a line");
    }
    static circle() {
        console.log("Draw a circle");
    }
    static rect() {
        console.log("Draw a square");
    }
    static triangle() {
        console.log("Draw a triangle");
    }
    static polygon() {
        console.log("Draw a polygon");
    }
    static text() {
        console.log("Draw a text");
    }
    static image() {
        console.log("Draw an image");
    }
}

export { BladeFire };