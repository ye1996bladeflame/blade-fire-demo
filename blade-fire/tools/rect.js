import { setCursor, history, createShape, getToolStyle, createListenerManager } from "../common/index.js";

let isDrawing = false;
let startX, startY;
let currentRect = null;
let svgElement = null;
const listeners = createListenerManager();

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

    currentRect = createShape("rect", {
        x: startX,
        y: startY,
        width: 0,
        height: 0,
        ...getToolStyle("rect")
    });
    
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
                 history.commit('创建矩形');
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

    listeners.activate();
    listeners.on(svgElement, "mousedown", onMouseDown);
    listeners.on(svgElement, "mousemove", onMouseMove);
    listeners.on(svgElement, "mouseup", onMouseUp);

    return () => {
        listeners.dispose();
        console.log("Deactivate rect tool");
    };
}
