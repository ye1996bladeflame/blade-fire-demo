import { setCursor, history, createShape, getToolStyle, createListenerManager, getDrawingArea } from "../common/index.js";
import { clampPoint } from "../common/draw-area.js";

/**
 * 旋转矩形工具。
 *
 * 交互流程（两个点 + 拖拽 + 点击提交）：
 *  1. 点击放置第一个点（边的起点）；
 *  2. 再点击放置第二个点（边的终点），形成第一条边；
 *  3. 按住鼠标拖拽，矩形沿边的单位法向量方向外扩（厚度 = 鼠标到边的垂直距离）；
 *  4. 松开后保留预览，再点击鼠标左键提交旋转矩形；
 *     若放置第二个点后未拖拽直接点击，同样以点击位置的外扩量立即提交。
 *  Escape 可逐级取消（拖拽 → 边 → 点）。
 *
 * 矩形以闭合 path 表示：边 + 边沿法向偏移后生成的四个顶点。
 */
const MIN_EDGE_LENGTH = 3;    // 边的最小长度（SVG 单位），过短视为误操作
const MIN_THICKNESS = 0.5;    // 外扩最小厚度，过薄视为退化矩形
const CLICK_THRESHOLD = 4;    // 屏幕像素，位移小于该值视为"点击"而非"拖拽"

export function rotateRect(svg) {
    console.log("RotateRect tool activated");

    const svgElement = svg;
    if (!svgElement) {
        console.error("BladeFire SVG not initialized");
        return;
    }
    setCursor(svgElement, "crosshair");

    // ---- 状态 ----
    let firstPoint = null;        // {x, y} 已放置的第一个点
    let marker = null;            // 第一个点的标记圆
    let guideLine = null;         // 第一个点到鼠标的边预览虚线
    let edgeCommitted = null;     // {x1, y1, x2, y2} 已确定的边
    let edgeLine = null;          // 已确定边的指示线
    let isExtruding = false;      // 正在拖拽外扩
    let rectPath = null;          // 拖拽中的矩形预览
    let normal = null;            // {nx, ny} 边的单位法向量
    let offset = 0;               // 当前外扩量
    let pressClient = null;       // 本次按下的屏幕坐标，用于区分点击/拖拽

    function getMousePosition(evt) {
        const CTM = svgElement.getScreenCTM();
        if (!CTM) return { x: 0, y: 0 };
        // 绘制坐标限制在绘制区域内
        return clampPoint(svgElement, (evt.clientX - CTM.e) / CTM.a, (evt.clientY - CTM.f) / CTM.d);
    }

    // 计算外扩量：鼠标相对边起点的位移在法向量上的投影（即鼠标到边的垂直距离）
    function computeOffset(pos) {
        const raw = (pos.x - edgeCommitted.x1) * normal.nx + (pos.y - edgeCommitted.y1) * normal.ny;
        return clampOffsetToDrawingArea(raw);
    }

    /**
     * 限制外扩量，使矩形整体落在绘制区域内（参照 rotateRectTool.js 的区间求交算法）。
     * 未配置绘制区域或边本身在区域外时不做限制。
     */
    function clampOffsetToDrawingArea(rawOffset) {
        const area = getDrawingArea(svgElement);
        if (!area) return rawOffset;
        const { x1, y1, x2, y2 } = edgeCommitted;
        const minX = area.x, minY = area.y, maxX = area.x + area.width, maxY = area.y + area.height;
        const fixedInBounds =
            x1 >= minX && x1 <= maxX && y1 >= minY && y1 <= maxY &&
            x2 >= minX && x2 <= maxX && y2 >= minY && y2 <= maxY;
        if (!fixedInBounds) return rawOffset;

        const eps = 1e-9;
        const interval1D = (p, dir, lo, hi) => {
            if (Math.abs(dir) < eps) {
                return p >= lo - eps && p <= hi + eps ? [-Infinity, Infinity] : null;
            }
            let a = (lo - p) / dir;
            let b = (hi - p) / dir;
            if (a > b) {
                const t = a;
                a = b;
                b = t;
            }
            return [a, b];
        };
        const intersect1D = (I, J) => {
            if (!I || !J) return null;
            const lo = Math.max(I[0], J[0]);
            const hi = Math.min(I[1], J[1]);
            return lo <= hi + eps ? [lo, hi] : null;
        };
        const rangeForVertex = (xv, yv) =>
            intersect1D(
                interval1D(xv, normal.nx, minX, maxX),
                interval1D(yv, normal.ny, minY, maxY)
            );
        // 底边两端固定，仅沿法向平移的两角随 offset 变化 → 取两角 offset 取值区间的交集
        let kRange = rangeForVertex(x2, y2);
        kRange = intersect1D(kRange, rangeForVertex(x1, y1));
        if (!kRange) return rawOffset;
        return Math.min(Math.max(rawOffset, kRange[0]), kRange[1]);
    }

    function buildRectPathData(o) {
        const { x1, y1, x2, y2 } = edgeCommitted;
        const round = (v) => Math.round(v * 100) / 100;
        return `M ${round(x1)} ${round(y1)} ` +
            `L ${round(x2)} ${round(y2)} ` +
            `L ${round(x2 + o * normal.nx)} ${round(y2 + o * normal.ny)} ` +
            `L ${round(x1 + o * normal.nx)} ${round(y1 + o * normal.ny)} Z`;
    }

    // ---- 第一步：放置第一个点 ----

    function placeFirstPoint(pos) {
        firstPoint = pos;
        marker = createShape("circle", {
            cx: pos.x, cy: pos.y, r: 5,
            fill: "rgba(0, 255, 0, 0.5)",
            stroke: "green",
            "pointer-events": "none",
        });
        svgElement.appendChild(marker);
        guideLine = createShape("line", {
            x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y,
            stroke: "green",
            "stroke-width": "1",
            "stroke-dasharray": "5,5",
            "pointer-events": "none",
        });
        svgElement.appendChild(guideLine);
    }

    // ---- 第二步：放置第二个点，确定边 ----

    function placeSecondPoint(pos) {
        const dx = pos.x - firstPoint.x;
        const dy = pos.y - firstPoint.y;
        const length = Math.sqrt(dx * dx + dy * dy);

        // 清理临时预览元素
        if (marker) { marker.remove(); marker = null; }
        if (guideLine) { guideLine.remove(); guideLine = null; }

        if (length < MIN_EDGE_LENGTH) {
            // 边太短 → 视为误操作，重新放置第一个点
            firstPoint = null;
            return;
        }

        edgeCommitted = { x1: firstPoint.x, y1: firstPoint.y, x2: pos.x, y2: pos.y };
        // 单位法向量（垂直于边）
        normal = { nx: -dy / length, ny: dx / length };
        firstPoint = null;

        // 显示已确定的边，提示用户下一步拖拽
        edgeLine = createShape("line", {
            x1: edgeCommitted.x1, y1: edgeCommitted.y1,
            x2: edgeCommitted.x2, y2: edgeCommitted.y2,
            stroke: "green",
            "stroke-width": "1",
            "pointer-events": "none",
        });
        svgElement.appendChild(edgeLine);
    }

    // ---- 第三步：拖拽外扩 ----

    function beginExtrude(pos) {
        isExtruding = true;
        offset = computeOffset(pos);
        if (!rectPath) {
            if (edgeLine) { edgeLine.remove(); edgeLine = null; }
            rectPath = createShape("path", {
                d: buildRectPathData(offset),
                "stroke-linejoin": "round",
                "stroke-linecap": "round",
                ...getToolStyle("rotate-rect"),
            });
            svgElement.appendChild(rectPath);
        }
    }

    // ---- 第四步：提交 / 取消 ----

    function removeRectPreview() {
        if (rectPath) { rectPath.remove(); rectPath = null; }
        // 恢复边的指示线，允许重新拖拽
        if (edgeCommitted && !edgeLine) {
            edgeLine = createShape("line", {
                x1: edgeCommitted.x1, y1: edgeCommitted.y1,
                x2: edgeCommitted.x2, y2: edgeCommitted.y2,
                stroke: "green",
                "stroke-width": "1",
                "pointer-events": "none",
            });
            svgElement.appendChild(edgeLine);
        }
    }

    function commitRect() {
        if (!rectPath) return;
        if (Math.abs(offset) < MIN_THICKNESS) {
            // 厚度过薄 → 不生成矩形
            removeRectPreview();
            return;
        }
        const path = rectPath;
        rectPath = null;
        isExtruding = false;
        pressClient = null;
        edgeCommitted = null;
        normal = null;
        offset = 0;
        if (edgeLine) { edgeLine.remove(); edgeLine = null; }
        history.commit("创建旋转矩形", { shapeType: "rotate-rect", relatedUids: [path.getAttribute("uid")] });
    }

    /** 逐级取消：拖拽 → 边 → 点 */
    function cancelAll() {
        if (isExtruding) {
            isExtruding = false;
            pressClient = null;
            removeRectPreview();
            return;
        }
        if (edgeCommitted) {
            if (rectPath) { rectPath.remove(); rectPath = null; }
            if (edgeLine) { edgeLine.remove(); edgeLine = null; }
            edgeCommitted = null;
            normal = null;
            offset = 0;
            return;
        }
        if (firstPoint) {
            if (marker) { marker.remove(); marker = null; }
            if (guideLine) { guideLine.remove(); guideLine = null; }
            firstPoint = null;
        }
    }

    // ---- 事件 ----

    function onMouseDown(evt) {
        if (evt.button !== 0) return;
        const pos = getMousePosition(evt);
        pressClient = { x: evt.clientX, y: evt.clientY };
        if (isExtruding) return;
        // 已有拖拽出的矩形预览 → 点击即提交（以拖拽确定的外扩量为准）
        if (edgeCommitted && rectPath) {
            commitRect();
            evt.preventDefault();
            return;
        }
        // 边已确定 → 开始拖拽外扩
        if (edgeCommitted) {
            beginExtrude(pos);
            evt.preventDefault();
            return;
        }
        // 已有第一个点 → 放置第二个点
        if (firstPoint) {
            placeSecondPoint(pos);
            evt.preventDefault();
            return;
        }
        // 放置第一个点
        placeFirstPoint(pos);
    }

    function onMouseMove(evt) {
        const pos = getMousePosition(evt);
        if (isExtruding) {
            offset = computeOffset(pos);
            rectPath.setAttribute("d", buildRectPathData(offset));
            return;
        }
        if (firstPoint && !edgeCommitted) {
            guideLine.setAttribute("x2", pos.x);
            guideLine.setAttribute("y2", pos.y);
        }
    }

    function onMouseUp(evt) {
        if (evt.button !== 0) return;
        if (!isExtruding) return;
        isExtruding = false;
        const dist = pressClient
            ? Math.hypot(evt.clientX - pressClient.x, evt.clientY - pressClient.y)
            : 0;
        pressClient = null;
        if (dist < CLICK_THRESHOLD) {
            // 无位移 → 视为点击，直接提交
            commitRect();
            return;
        }
        // 拖拽结束 → 保留预览，等待最终点击提交
        if (Math.abs(offset) < MIN_THICKNESS) {
            removeRectPreview();
        }
    }

    function onKeyDown(evt) {
        if (evt.key === "Escape") {
            cancelAll();
            evt.preventDefault();
        }
    }

    const listeners = createListenerManager();
    listeners.on(svgElement, "mousedown", onMouseDown);
    listeners.on(window, "mousemove", onMouseMove);
    listeners.on(window, "mouseup", onMouseUp);
    listeners.on(document, "keydown", onKeyDown);

    return () => {
        listeners.dispose();
        // 清理所有残留的预览元素
        if (marker) { marker.remove(); marker = null; }
        if (guideLine) { guideLine.remove(); guideLine = null; }
        if (edgeLine) { edgeLine.remove(); edgeLine = null; }
        if (rectPath) { rectPath.remove(); rectPath = null; }
        firstPoint = null;
        edgeCommitted = null;
        normal = null;
        offset = 0;
        isExtruding = false;
        pressClient = null;
        console.log("Deactivate rotate-rect tool");
    };
}
