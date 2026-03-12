import { setCursor } from "../common/index.js";

let isDrawing = false;
let startX, startY;
let currentCircle = null;
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
    currentCircle = document.createElementNS(svgNS, "ellipse");
    currentCircle.setAttribute("cx", startX);
    currentCircle.setAttribute("cy", startY);
    currentCircle.setAttribute("rx", 0);
    currentCircle.setAttribute("ry", 0);
    currentCircle.setAttribute("fill", "rgba(255, 99, 71, 0.3)"); // Tomato with opacity
    currentCircle.setAttribute("stroke", "#FF6347");
    currentCircle.setAttribute("stroke-width", "2");
    
    svgElement.appendChild(currentCircle);
}

function onMouseMove(evt) {
    if (!isDrawing || !currentCircle) return;

    const pos = getMousePosition(evt);
    const currentX = pos.x;
    const currentY = pos.y;

    // Calculate dimensions for ellipse
    // Use Math.abs to ensure positive radii
    const rx = Math.abs(currentX - startX) / 2;
    const ry = Math.abs(currentY - startY) / 2;
    
    // Center is the midpoint between start and current
    const cx = (startX + currentX) / 2;
    const cy = (startY + currentY) / 2;

    currentCircle.setAttribute("cx", cx);
    currentCircle.setAttribute("cy", cy);
    currentCircle.setAttribute("rx", rx);
    currentCircle.setAttribute("ry", ry);
}

function onMouseUp(evt) {
    if (isDrawing) {
        isDrawing = false;
        currentCircle = null;
        console.log("Circle drawn");
    }
}

export function circle(svg) {
    console.log("Activate circle tool");
    
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
        console.log("Deactivate circle tool");
    };
}