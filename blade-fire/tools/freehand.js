import { setCursor, history, createShape, getToolStyle, createListenerManager } from "../common/index.js";
import { clampPoint } from "../common/draw-area.js";

let isDrawing = false;
let currentPath = null;
let svgElement = null;
let pathData = "";
const listeners = createListenerManager();

function getMousePosition(evt) {
    if (!svgElement) return { x: 0, y: 0 };
    const CTM = svgElement.getScreenCTM();
    if (!CTM) return { x: 0, y: 0 };
    // 绘制坐标限制在绘制区域内
    return clampPoint(svgElement, (evt.clientX - CTM.e) / CTM.a, (evt.clientY - CTM.f) / CTM.d);
}

function onMouseDown(evt) {
    if (evt.button !== 0) return; // Only left click

    isDrawing = true;
    const pos = getMousePosition(evt);
    
    // Start path
    pathData = `M ${pos.x} ${pos.y}`;
    
    currentPath = createShape("path", {
        d: pathData,
        ...getToolStyle("freehand")
    });
    
    svgElement.appendChild(currentPath);
}

function onMouseMove(evt) {
    if (!isDrawing || !currentPath) return;

    const pos = getMousePosition(evt);
    
    // Append line to current position
    pathData += ` L ${pos.x} ${pos.y}`;
    currentPath.setAttribute("d", pathData);
}

function onMouseUp(evt) {
    if (isDrawing) {
        isDrawing = false;
        if (currentPath) {
             // Close the path
             pathData += " Z";
             currentPath.setAttribute("d", pathData);

             history.commit('手绘多边形', { shapeType: 'freehand', relatedUids: [currentPath.getAttribute('uid')] });
        }
        currentPath = null;
        pathData = "";
        console.log("Freehand drawing finished");
    }
}

export function freehand(svg) {
    console.log("Activate freehand tool");
    
    svgElement = svg;
    if (!svgElement) {
        console.error("BladeFire SVG not initialized");
        return;
    }

    setCursor(svgElement, "crosshair");
    
    listeners.activate();
    listeners.on(svgElement, "mousedown", onMouseDown);
    listeners.on(window, "mousemove", onMouseMove);
    listeners.on(window, "mouseup", onMouseUp);

    return () => {
        listeners.dispose();
    };
}
