import { setCursor, history } from "../common/index.js";

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
    currentRect.setAttribute("fill", "rgba(100, 149, 237, 0.3)"); 
    currentRect.setAttribute("stroke", "#6495ED");
    currentRect.setAttribute("stroke-width", "1");
    
    svgElement.appendChild(currentRect);
}

function onMouseMove(evt) {
    if (!isDrawing || !currentRect) return;

    const pos = getMousePosition(evt);
    const currentX = pos.x;
    const currentY = pos.y;

    
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);

    
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
        if (currentRect) {
             const width = parseFloat(currentRect.getAttribute("width"));
             const height = parseFloat(currentRect.getAttribute("height"));
             if (width > 0 && height > 0) {
                 const rect = currentRect;
                 history.push({
                     undo: () => rect.remove(),
                     redo: () => svgElement.appendChild(rect)
                 });
             } else {
                 currentRect.remove();
             }
        }
        currentRect = null;
        console.log("Rect drawn");
    }
}

export function rect(svg) {
    console.log("Activate rect tool");
    
    
    svgElement = svg;
    if (!svgElement) {
        console.error("BladeFire SVG not initialized");
        return;
    }

    
    setCursor(svgElement, "crosshair");

    
    svgElement.removeEventListener("mousedown", onMouseDown);
    svgElement.removeEventListener("mousemove", onMouseMove);
    svgElement.removeEventListener("mouseup", onMouseUp);

    
    svgElement.addEventListener("mousedown", onMouseDown);
    svgElement.addEventListener("mousemove", onMouseMove);
    svgElement.addEventListener("mouseup", onMouseUp);

    
    return () => {
        svgElement.removeEventListener("mousedown", onMouseDown);
        svgElement.removeEventListener("mousemove", onMouseMove);
        svgElement.removeEventListener("mouseup", onMouseUp);
        console.log("Deactivate rect tool");
    };
}
