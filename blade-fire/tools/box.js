import { setCursor, createListenerManager } from "../common/index.js";
import { clampPoint } from "../common/draw-area.js";

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * 框选工具：参考 aiSelectTool 的框选交互实现，仅绘制可视的框选虚线框。
 * 与 aiSelectTool 不同，它不会框选/选中任何元素；同时框选范围始终被
 * 限制在绘制区域内（draw-area="true"）。
 */
export function box(svg) {
    if (!svg) {
        console.error("BladeFire SVG not initialized");
        return;
    }

    setCursor(svg, "crosshair");

    const listeners = createListenerManager();

    let activePointerId = null;
    let startPos = null;
    let boxRect = null;

    // 客户端坐标 -> SVG 用户坐标，并限制在绘制区域内
    const toAreaPoint = (clientX, clientY) => {
        const CTM = svg.getScreenCTM();
        if (!CTM) return { x: 0, y: 0 };
        return clampPoint(svg, (clientX - CTM.e) / CTM.a, (clientY - CTM.f) / CTM.d);
    };

    const endBox = () => {
        boxRect?.remove();
        boxRect = null;
        startPos = null;
        activePointerId = null;
    };

    const onPointerDown = (e) => {
        if (e.button > 0 || !1 === e.isPrimary) return;

        activePointerId = e.pointerId;
        startPos = toAreaPoint(e.clientX, e.clientY);

        boxRect = document.createElementNS(SVG_NS, "rect");
        boxRect.setAttribute("x", startPos.x);
        boxRect.setAttribute("y", startPos.y);
        boxRect.setAttribute("width", 0);
        boxRect.setAttribute("height", 0);
        boxRect.setAttribute("fill", "rgba(24, 144, 255, 0.1)");
        boxRect.setAttribute("stroke", "#1890ff");
        boxRect.setAttribute("stroke-width", 1);
        boxRect.setAttribute("stroke-dasharray", "4 2");
        boxRect.setAttribute("pointer-events", "none");
        svg.appendChild(boxRect);
    };

    const onPointerMove = (e) => {
        if (e.pointerId !== activePointerId || !boxRect) return;

        const pos = toAreaPoint(e.clientX, e.clientY);
        const x = Math.min(startPos.x, pos.x);
        const y = Math.min(startPos.y, pos.y);
        const width = Math.abs(pos.x - startPos.x);
        const height = Math.abs(pos.y - startPos.y);

        boxRect.setAttribute("x", x);
        boxRect.setAttribute("y", y);
        boxRect.setAttribute("width", width);
        boxRect.setAttribute("height", height);
    };

    const onPointerUp = (e) => {
        if (e.pointerId !== activePointerId) return;
        // 框选仅作可视反馈，不选中任何元素，松手即移除
        endBox();
    };

    listeners.activate();
    listeners.on(svg, "pointerdown", onPointerDown);
    listeners.on(window, "pointermove", onPointerMove);
    listeners.on(window, "pointerup", onPointerUp);
    listeners.on(window, "pointercancel", onPointerUp);

    return () => {
        endBox();
        listeners.dispose();
    };
}
