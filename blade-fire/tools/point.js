import { setCursor, history, createShape, getToolStyle, createListenerManager } from "../common/index.js";
import { clampPoint } from "../common/draw-area.js";

let svgElement = null;
const listeners = createListenerManager();

function getMousePosition(evt) {
    if (!svgElement) return { x: 0, y: 0 };
    const CTM = svgElement.getScreenCTM();
    if (!CTM) return { x: 0, y: 0 };
    // 绘制坐标限制在绘制区域内
    return clampPoint(svgElement, (evt.clientX - CTM.e) / CTM.a, (evt.clientY - CTM.f) / CTM.d);
}

function onMouseDown(evt) {
    if (evt.button !== 0 && evt.button !== 2) return;

    const pos = getMousePosition(evt);
    const isLeft = evt.button === 0;

    // 以屏幕像素 6px 为基准换算成画布坐标，保证任意缩放下点的大小一致
    const vb = svgElement.viewBox?.baseVal;
    const scale = vb?.width && svgElement.clientWidth ? vb.width / svgElement.clientWidth : 1;
    const r = 6 * scale;

    const point = createShape("ellipse", {
        cx: pos.x,
        cy: pos.y,
        rx: r,
        ry: r,
        "data-type": "point",
        "data-mode": isLeft ? "1" : "0",
        ...getToolStyle("point"),
        fill: isLeft ? '#12C785' : '#EF6262',
        stroke: isLeft ? '#12C785' : '#EF6262'
    });

    svgElement.appendChild(point);
    history.commit('添加点标记', { shapeType: 'point', relatedUids: [point.getAttribute('uid')] });
}

function onContextMenu(evt) {
    evt.preventDefault();
}

export function point(svg) {
    svgElement = svg;
    if (!svgElement) {
        console.error("BladeFire SVG not initialized");
        return;
    }

    setCursor(svgElement, "crosshair");

    listeners.activate();
    listeners.on(svgElement, "mousedown", onMouseDown);
    listeners.on(svgElement, "contextmenu", onContextMenu);

    return () => {
        listeners.dispose();
    };
}
