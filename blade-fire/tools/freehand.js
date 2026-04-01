import { setCursor, history, createShape } from "../common/index.js";

let isDrawing = false;
let currentPath = null;
let svgElement = null;
let pathData = "";

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
    if (evt.button !== 0) return; // Only left click

    isDrawing = true;
    const pos = getMousePosition(evt);
    
    // Start path
    pathData = `M ${pos.x} ${pos.y}`;
    
    currentPath = createShape("path", {
        d: pathData,
        fill: "rgba(100, 149, 237, 0.3)",
        "stroke-linecap": "round",
        "stroke-linejoin": "round"
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

             const path = currentPath;
             history.push({
                 desc: '手绘多边形',
                 undo: () => path.remove(),
                 redo: () => svgElement.appendChild(path)
             });
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
    
    svgElement.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
        svgElement.removeEventListener("mousedown", onMouseDown);
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
    };
}
