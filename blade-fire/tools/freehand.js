import { setCursor, history, createShape, getToolStyle, createListenerManager } from "../common/index.js";
import { createPathEditor } from "../common/path-editor.js";
import { clampPoint } from "../common/draw-area.js";

let isDrawing = false;
let currentPath = null;
let svgElement = null;
let pathData = "";
const listeners = createListenerManager();
// 当前激活的通用路径编辑器实例（双击已有手绘图形进入编辑模式）
let pathEditor = null;

function getMousePosition(evt) {
    if (!svgElement) return { x: 0, y: 0 };
    const CTM = svgElement.getScreenCTM();
    if (!CTM) return { x: 0, y: 0 };
    // 绘制坐标限制在绘制区域内
    return clampPoint(svgElement, (evt.clientX - CTM.e) / CTM.a, (evt.clientY - CTM.f) / CTM.d);
}

function onMouseDown(evt) {
    if (pathEditor && pathEditor.guardMouseDown(evt)) return;
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

             // 单击未拖动（如双击进入编辑模式时的第一击）不会产生有效笔迹，不生成退化图形
             if (pathData.includes(' L ')) {
                 history.commit('手绘多边形', { shapeType: 'freehand', relatedUids: [currentPath.getAttribute('uid')] });
             } else {
                 currentPath.remove();
             }
        }
        currentPath = null;
        pathData = "";
        console.log("Freehand drawing finished");
    }
}

export function freehand(svg, onSelectionChangeCallback) {
    console.log("Activate freehand tool");
    
    svgElement = svg;
    if (!svgElement) {
        console.error("BladeFire SVG not initialized");
        return;
    }

    setCursor(svgElement, "crosshair");

    // 双击已有手绘图形 → 进入编辑模式（选中 + 顶点手柄，不影响左键绘制）
    pathEditor = createPathEditor(svg, {
        onSelectionChange: onSelectionChangeCallback,
        onIsDrawing: () => isDrawing,
        historyDesc: '调整手绘图形顶点',
        historyShapeType: 'freehand',
    });
    pathEditor.attach();
    
    listeners.activate();
    listeners.on(svgElement, "mousedown", onMouseDown);
    listeners.on(window, "mousemove", onMouseMove);
    listeners.on(window, "mouseup", onMouseUp);

    return () => {
        listeners.dispose();
        if (pathEditor) {
            pathEditor.dispose();
            pathEditor = null;
        }
    };
}
