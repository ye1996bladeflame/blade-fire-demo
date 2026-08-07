import { setCursor, history, createShape, getToolStyle, createListenerManager } from "../common/index.js";
import { createPathEditor } from "../common/path-editor.js";
import { clampPoint } from "../common/draw-area.js";

let isDrawing = false;
let startX, startY;
let currentTriangle = null;
let svgElement = null;
const listeners = createListenerManager();
// 当前激活的通用路径编辑器实例（双击已有三角形进入编辑模式）
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
                 history.commit('创建三角形', { shapeType: 'triangle', relatedUids: [currentTriangle.getAttribute('uid')] });
             } else {
                 currentTriangle.remove();
             }
        }
        currentTriangle = null;
        console.log("Triangle drawn");
    }
}

export function triangle(svg, onSelectionChangeCallback) {
    console.log("Triangle tool activated");
    
    
    svgElement = svg;
    if (!svgElement) {
        console.error("BladeFire SVG not initialized");
        return;
    }

    
    setCursor(svgElement, "crosshair");

    // 双击已有三角形 → 进入编辑模式（选中 + 顶点手柄，不影响左键绘制）
    pathEditor = createPathEditor(svg, {
        onSelectionChange: onSelectionChangeCallback,
        onIsDrawing: () => isDrawing,
        historyDesc: '调整三角形顶点',
        historyShapeType: 'triangle',
    });
    pathEditor.attach();

    listeners.activate();
    listeners.on(svgElement, "mousedown", onMouseDown);
    listeners.on(svgElement, "mousemove", onMouseMove);
    listeners.on(svgElement, "mouseup", onMouseUp);

    return () => {
        listeners.dispose();
        if (pathEditor) {
            pathEditor.dispose();
            pathEditor = null;
        }
        console.log("Deactivate triangle tool");
    };
}
