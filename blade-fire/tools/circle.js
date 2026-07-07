import { setCursor, history, createShape, getToolStyle, createListenerManager } from "../common/index.js";

let isDrawing = false;
let startX, startY;
let currentCircle = null;
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

    currentCircle = createShape("ellipse", {
        cx: startX,
        cy: startY,
        rx: 0,
        ry: 0,
        ...getToolStyle("circle")
    });
    
    svgElement.appendChild(currentCircle);
}

function onMouseMove(evt) {
    if (!isDrawing || !currentCircle) return;

    const pos = getMousePosition(evt);
    const currentX = pos.x;
    const currentY = pos.y;

    
    
    const rx = Math.abs(currentX - startX) / 2;
    const ry = Math.abs(currentY - startY) / 2;
    
    
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
        if (currentCircle) {
             const rx = parseFloat(currentCircle.getAttribute("rx"));
             const ry = parseFloat(currentCircle.getAttribute("ry"));
             if (rx > 0 && ry > 0) {
                 const circle = currentCircle;
                 history.push({
                     desc: '创建圆形',
                     undo: () => circle.remove(),
                     redo: () => svgElement.appendChild(circle)
                 });
             } else {
                 currentCircle.remove();
             }
        }
        currentCircle = null;
        console.log("Circle drawn");
    }
}

export function circle(svg) {
    console.log("Activate circle tool");
    
    
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
        console.log("Deactivate circle tool");
    };
}
