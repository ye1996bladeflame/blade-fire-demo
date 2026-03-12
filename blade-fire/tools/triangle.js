import { setCursor, history } from "../common/index.js";

let isDrawing = false;
let startX, startY;
let currentTriangle = null;
let svgElement = null;

function getMousePosition(evt) {
    if (!svgElement) return { x: 0, y: 0 };
    const CTM = svgElement.getScreenCTM();
    if (!CTM) return { x: 0, y: 0 };
    return {
        x: (evt.clientX - CTM.e) / CTM.a,
        y: (evt.clientY - CTM.f) / CTM.d
    };
}

function onMouseDown(evt) {
    // Only allow left mouse button (button 0)
    if (evt.button !== 0) return;

    isDrawing = true;
    const pos = getMousePosition(evt);
    startX = pos.x;
    startY = pos.y;

    const svgNS = "http://www.w3.org/2000/svg";
    currentTriangle = document.createElementNS(svgNS, "path");
    
    // Initial path (just a point)
    currentTriangle.setAttribute("d", `M ${startX} ${startY} L ${startX} ${startY} L ${startX} ${startY} Z`);
    currentTriangle.setAttribute("fill", "rgba(100, 149, 237, 0.3)"); // CornflowerBlue with opacity
    currentTriangle.setAttribute("stroke", "#6495ED");
    currentTriangle.setAttribute("stroke-width", "1");
    
    svgElement.appendChild(currentTriangle);
}

function onMouseMove(evt) {
    if (!isDrawing || !currentTriangle) return;

    const pos = getMousePosition(evt);
    const currentX = pos.x;
    const currentY = pos.y;

    // Calculate bounding box
    const minX = Math.min(startX, currentX);
    const maxX = Math.max(startX, currentX);
    const minY = Math.min(startY, currentY);
    const maxY = Math.max(startY, currentY);

    // Calculate triangle vertices (Isosceles triangle pointing up)
    // Top point (center of top edge)
    const topX = minX + (maxX - minX) / 2;
    const topY = minY;
    
    // Bottom right
    const bottomRightX = maxX;
    const bottomRightY = maxY;
    
    // Bottom left
    const bottomLeftX = minX;
    const bottomLeftY = maxY;

    // Update path
    const d = `M ${topX} ${topY} L ${bottomRightX} ${bottomRightY} L ${bottomLeftX} ${bottomLeftY} Z`;
    currentTriangle.setAttribute("d", d);
}

function onMouseUp(evt) {
    if (isDrawing) {
        isDrawing = false;
        if (currentTriangle) {
             const bbox = currentTriangle.getBBox();
             if (bbox.width > 0 && bbox.height > 0) {
                 const triangle = currentTriangle;
                 history.push({
                     undo: () => triangle.remove(),
                     redo: () => svgElement.appendChild(triangle)
                 });
             } else {
                 currentTriangle.remove();
             }
        }
        currentTriangle = null;
        console.log("Triangle drawn");
    }
}

export function triangle(svg) {
    console.log("Triangle tool activated");
    
    // Set SVG element from parameter
    svgElement = svg;
    if (!svgElement) {
        console.error("BladeFire SVG not initialized");
        return;
    }

    // Set cursor
    setCursor(svgElement, "crosshair");

    // Remove existing event listeners to avoid duplication
    svgElement.removeEventListener("mousedown", onMouseDown);
    svgElement.removeEventListener("mousemove", onMouseMove);
    svgElement.removeEventListener("mouseup", onMouseUp);

    // Add new listeners
    svgElement.addEventListener("mousedown", onMouseDown);
    svgElement.addEventListener("mousemove", onMouseMove);
    svgElement.addEventListener("mouseup", onMouseUp);

    // Return cleanup function
    return () => {
        svgElement.removeEventListener("mousedown", onMouseDown);
        svgElement.removeEventListener("mousemove", onMouseMove);
        svgElement.removeEventListener("mouseup", onMouseUp);
        console.log("Deactivate triangle tool");
    };
}
