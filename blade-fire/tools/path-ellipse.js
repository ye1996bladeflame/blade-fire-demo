import { setCursor, history, createShape, getToolStyle, createListenerManager } from "../common/index.js";
import { createPathEditor } from "../common/path-editor.js";
import { clampPoint } from "../common/draw-area.js";

let isDrawing = false;
let startX, startY;
let currentEllipse = null;
let svgElement = null;
const listeners = createListenerManager();
// 当前激活的通用路径编辑器实例（双击已有路径椭圆进入编辑模式）
let pathEditor = null;

function getMousePosition(evt) {
    if (!svgElement) return { x: 0, y: 0 };
    const CTM = svgElement.getScreenCTM();
    if (!CTM) return { x: 0, y: 0 };
    // 绘制坐标限制在绘制区域内
    return clampPoint(svgElement, (evt.clientX - CTM.e) / CTM.a, (evt.clientY - CTM.f) / CTM.d);
}

/**
 * 生成椭圆路径（参考 pathEllipseTool.js：每 6° 取一个点，共 60 段，闭合为 Z）。
 */
function buildEllipsePath(cx, cy, rx, ry) {
    const groups = 60; // 每组的数量
    const step = 6; // 每隔 6 度取一个点
    let pathData = "M ";
    for (let i = 0; i <= groups; i++) { // 包含头尾
        const angle = (i * step) % 360; // 0 到 360 度
        const rad = (angle * Math.PI) / 180;
        const x = cx + rx * Math.cos(rad);
        const y = cy + ry * Math.sin(rad);
        pathData += `${x.toFixed(9)} ${y.toFixed(9)}`;
        if (i < groups) {
            pathData += " L ";
        }
    }
    pathData += " Z";
    return pathData;
}

function onMouseDown(evt) {
    if (pathEditor && pathEditor.guardMouseDown(evt)) return;
    if (evt.button !== 0) return;

    isDrawing = true;
    const pos = getMousePosition(evt);
    startX = pos.x;
    startY = pos.y;

    currentEllipse = createShape("path", {
        "data-special-id": "path-ellipse-tool",
        ...getToolStyle("pathEllipse")
    });
    svgElement.appendChild(currentEllipse);
}

function onMouseMove(evt) {
    if (!isDrawing || !currentEllipse) return;

    const pos = getMousePosition(evt);
    const currentX = pos.x;
    const currentY = pos.y;

    const i = currentX - startX || 1;
    const o = currentY - startY || 1;
    let t = Math.abs(i);
    let e = Math.abs(o);
    // 是否正圆
    if (evt.shiftKey) {
        const minDis = Math.min(t, e);
        t = minDis;
        e = minDis;
    }
    const r = i < 0 ? startX - t : startX;
    const a = o < 0 ? startY - e : startY;
    const cx = r + t / 2;
    const cy = a + e / 2;
    const rx = t / 2;
    const ry = e / 2;

    currentEllipse.setAttribute("d", buildEllipsePath(cx, cy, rx, ry));
}

function onMouseUp(evt) {
    if (isDrawing) {
        isDrawing = false;
        if (currentEllipse) {
            // 通过包围盒判断是否为有效椭圆，避免画出单个点
            try {
                const bbox = currentEllipse.getBBox();
                if (bbox.width > 0 && bbox.height > 0) {
                    history.commit("创建椭圆", { shapeType: "pathEllipse", relatedUids: [currentEllipse.getAttribute("uid")] });
                } else {
                    currentEllipse.remove();
                }
            } catch {
                currentEllipse.remove();
            }
        }
        currentEllipse = null;
        console.log("Path ellipse drawn");
    }
}

export function pathEllipse(svg, onSelectionChangeCallback) {
    console.log("Activate path ellipse tool");

    svgElement = svg;
    if (!svgElement) {
        console.error("BladeFire SVG not initialized");
        return;
    }

    setCursor(svgElement, "crosshair");

    // 双击已有路径椭圆 → 进入编辑模式（选中 + 顶点手柄，不影响左键绘制）
    pathEditor = createPathEditor(svg, {
        onSelectionChange: onSelectionChangeCallback,
        onIsDrawing: () => isDrawing,
        historyDesc: '调整椭圆顶点',
        historyShapeType: 'pathEllipse',
    });
    pathEditor.attach();

    listeners.activate();
    listeners.on(svgElement, "mousedown", onMouseDown);
    listeners.on(svgElement, "mousemove", onMouseMove);
    listeners.on(window, "mouseup", onMouseUp);

    return () => {
        listeners.dispose();
        if (pathEditor) {
            pathEditor.dispose();
            pathEditor = null;
        }
        console.log("Deactivate path ellipse tool");
    };
}
