import { setCursor, history, createShape, getToolStyle, createListenerManager } from "../common/index.js";

let isDrawing = false;
let startX, startY;
let currentTriangle = null;
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

    currentTriangle = createShape("path", {
        d: `M ${startX} ${startY} L ${startX} ${startY} L ${startX} ${startY} Z`,
        ...getToolStyle("triangle")
    });
    
    svgElement.appendChild(currentTriangle);
}

function onMouseMove(evt) {
    if (!isDrawing || !currentTriangle) return;

    const pos = getMousePosition(evt);
    const currentX = pos.x;
    const currentY = pos.y;

    
    const minX = Math.min(startX, currentX);
    const maxX = Math.max(startX, currentX);
    const minY = Math.min(startY, currentY);
    const maxY = Math.max(startY, currentY);

    
    
    const topX = minX + (maxX - minX) / 2;
    const topY = minY;
    
    
    const bottomRightX = maxX;
    const bottomRightY = maxY;
    
    
    const bottomLeftX = minX;
    const bottomLeftY = maxY;

    
    const d = `M ${topX} ${topY} L ${bottomRightX} ${bottomRightY} L ${bottomLeftX} ${bottomLeftY} Z`;
    currentTriangle.setAttribute("d", d);
}

function onMouseUp(evt) {
    if (isDrawing) {
        isDrawing = false;
        if (currentTriangle) {
             const bbox = currentTriangle.getBBox();
             if (bbox.width > 0 && bbox.height > 0) {
                 history.commit('创建三角形');
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
        console.log("Deactivate triangle tool");
    };
}
