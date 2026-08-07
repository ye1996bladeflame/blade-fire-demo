import { setCursor, history, createShape, getToolStyle, createListenerManager } from "../common/index.js";
import { createPathEditor } from "../common/path-editor.js";
import { clampPoint } from "../common/draw-area.js";

let isDrawing = false;
let startX, startY;
let currentPathRect = null;
let svgElement = null;
const listeners = createListenerManager();
// 当前激活的通用路径编辑器实例（双击已有路径矩形进入编辑模式）
let pathEditor = null;

function getMousePosition(evt) {
    if (!svgElement) return { x: 0, y: 0 };
    const CTM = svgElement.getScreenCTM();
    if (!CTM) return { x: 0, y: 0 };
    // 绘制坐标限制在绘制区域内
    return clampPoint(svgElement, (evt.clientX - CTM.e) / CTM.a, (evt.clientY - CTM.f) / CTM.d);
}

/**
 * 构建矩形 path 数据（参考 pathRectTool.js）：
 * 起点为左下角，顺时针依次为 左下 → 右下 → 右上 → 左上 → 闭合。
 */
function buildPathData(x, y, width, height) {
    return `M ${x} ${y + height} L ${x + width} ${y + height} L ${x + width} ${y} L ${x} ${y} Z`;
}

function onMouseDown(evt) {
    if (pathEditor && pathEditor.guardMouseDown(evt)) return;
    if (evt.button !== 0) return;

    isDrawing = true;
    const pos = getMousePosition(evt);
    startX = pos.x;
    startY = pos.y;

    currentPathRect = createShape("path", {
        d: buildPathData(startX, startY, 0, 0),
        ...getToolStyle("path-rect")
    });

    svgElement.appendChild(currentPathRect);
}

function onMouseMove(evt) {
    if (!isDrawing || !currentPathRect) return;

    const pos = getMousePosition(evt);
    const currentX = pos.x;
    const currentY = pos.y;

    let width = Math.abs(currentX - startX);
    let height = Math.abs(currentY - startY);
    // Shift 约束为正方形
    if (evt.shiftKey) {
        const side = Math.min(width, height);
        width = side;
        height = side;
    }

    const x = currentX < startX ? startX - width : startX;
    const y = currentY < startY ? startY - height : startY;

    currentPathRect.setAttribute("d", buildPathData(x, y, width, height));
}

function onMouseUp(evt) {
    if (isDrawing) {
        isDrawing = false;
        if (currentPathRect) {
            const bbox = currentPathRect.getBBox();
            if (bbox.width > 0 && bbox.height > 0) {
                history.commit('创建路径矩形', { shapeType: 'path-rect', relatedUids: [currentPathRect.getAttribute('uid')] });
            } else {
                currentPathRect.remove();
            }
        }
        currentPathRect = null;
        console.log("PathRect drawn");
    }
}

export function pathRect(svg, onSelectionChangeCallback) {
    console.log("Activate path-rect tool");

    svgElement = svg;
    if (!svgElement) {
        console.error("BladeFire SVG not initialized");
        return;
    }

    setCursor(svgElement, "crosshair");

    // 双击已有路径矩形 → 进入编辑模式（选中 + 顶点手柄，不影响左键绘制）
    pathEditor = createPathEditor(svg, {
        onSelectionChange: onSelectionChangeCallback,
        onIsDrawing: () => isDrawing,
        historyDesc: '调整路径矩形顶点',
        historyShapeType: 'path-rect',
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
        isDrawing = false;
        currentPathRect = null;
        console.log("Deactivate path-rect tool");
    };
}
