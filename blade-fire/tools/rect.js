import { setCursor } from "../common/index.js";

let isDrawing = false;
let startX, startY;
let currentRect = null;
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
    currentRect = document.createElementNS(svgNS, "rect");
    currentRect.setAttribute("x", startX);
    currentRect.setAttribute("y", startY);
    currentRect.setAttribute("width", 0);
    currentRect.setAttribute("height", 0);
    currentRect.setAttribute("fill", "rgba(100, 149, 237, 0.3)"); // CornflowerBlue with opacity
    currentRect.setAttribute("stroke", "#6495ED");
    currentRect.setAttribute("stroke-width", "1");
    
    svgElement.appendChild(currentRect);
}

function onMouseMove(evt) {
    if (!isDrawing || !currentRect) return;

    const pos = getMousePosition(evt);
    const currentX = pos.x;
    const currentY = pos.y;

    // Calculate width and height
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);

    // Calculate new x and y (handle drawing in any direction)
    const newX = currentX < startX ? currentX : startX;
    const newY = currentY < startY ? currentY : startY;

    currentRect.setAttribute("x", newX);
    currentRect.setAttribute("y", newY);
    currentRect.setAttribute("width", width);
    currentRect.setAttribute("height", height);
}

function onMouseUp(evt) {
    if (isDrawing) {
        isDrawing = false;
        currentRect = null;
        console.log("Rect drawn");
    }
}

export function rect(svg) {
    console.log("Activate rect tool");
    
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
        console.log("Deactivate rect tool");
    };
}