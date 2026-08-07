import { setCursor, history, createShape, createListenerManager } from "../common/index.js";
import { createPathEditor } from "../common/path-editor.js";
import { getDrawingArea, clampPoint } from "../common/draw-area.js";

/**
 * OCR 不规则图形工具（参考 ocrTool.js 的 OcrTool 逻辑）。
 *
 * 交互流程：
 *   1. 左键逐点打点，预览一条开放折线轮廓；
 *   2. 右键确认闭合 —— 至少 2 个点才能确认（与 ocrTool.js close() 的
 *      validCommands.length >= 2 判断一致）；
 *   3. 确认后按住左键拖拽，沿各顶点法向量把轮廓"拉出"成一个封闭的不规则图形；
 *   4. 松开左键提交到历史记录。
 */
export function ocr(svg, onSelectionChangeCallback) {
    console.log("OCR tool activated");
    if (svg) {
        setCursor(svg, "crosshair");
    }

    // ---- 阶段一：逐点绘制状态 ----
    let points = [];          // 已打下的锚点
    let activePath = null;    // 预览轮廓
    let guideLine = null;     // 引导线（当前点到上一锚点）
    let startPointMarker = null;
    let toolGroup = null;

    // ---- 阶段二：右键确认后的拖拽拉出状态 ----
    let confirmed = false;    // 是否已右键确认（进入拖拽拉出模式）
    let tempPath = null;      // 确认后保留的基准轮廓
    let dragGeometry = null;  // 拉出所需的法向量 / 投影轴 / 边界约束数据
    let ocrPath = null;       // 正在拖拽生成的不规则图形
    let hasCreatedShape = false;
    let ocrCommitted = false; // 拉出的图形是否已提交历史（提交后不再清理）
    let initClientX = 0;
    let initClientY = 0;
    let frameId = 0;
    let pendingDistance = null;
    let lastAppliedPathData = "";
    let dragCleanup = null;   // 拖拽期间 window 监听器的清理函数

    const listeners = createListenerManager();

    // 双击已有 OCR 不规则图形 → 进入编辑模式（选中 + 顶点手柄，不影响左键绘制）
    const editor = createPathEditor(svg, {
        onSelectionChange: onSelectionChangeCallback,
        onIsDrawing: () => !!(activePath || confirmed || ocrPath),
        historyDesc: '调整OCR图形顶点',
        historyShapeType: 'ocr',
    });
    editor.attach();

    function getMousePos(evt) {
        const CTM = svg.getScreenCTM();
        if (!CTM) return { x: 0, y: 0 };
        // 绘制坐标限制在绘制区域内
        return clampPoint(svg, (evt.clientX - CTM.e) / CTM.a, (evt.clientY - CTM.f) / CTM.d);
    }

    function updatePath() {
        if (!activePath || points.length === 0) return;
        let d = `M ${points[0].x} ${points[0].y}`;
        for (let i = 1; i < points.length; i++) {
            d += ` L ${points[i].x} ${points[i].y}`;
        }
        activePath.setAttribute("d", d);
    }

    // 统计 path d 中的坐标组数量，用于"至少 2 个点"的右键确认校验
    function countPoints(pathData) {
        const commands = (pathData || "").split(/[a-zA-Z]/);
        return commands.filter(cmd => cmd.trim() !== "").length;
    }

    // 提取顶点数组（去掉闭合路径中重复的首尾点，避免生成重合锚点）
    function parseVertices(pathData) {
        const sourcePoints = (pathData.match(/[-+]?\d+(\.\d+)?/g) || []).map(Number);
        const normalizedPoints = [];
        for (let i = 0; i < sourcePoints.length; i += 2) {
            normalizedPoints.push([sourcePoints[i], sourcePoints[i + 1]]);
        }
        if (normalizedPoints.length > 1) {
            const [firstX, firstY] = normalizedPoints[0];
            const [lastX, lastY] = normalizedPoints.at(-1);
            if (Math.abs(firstX - lastX) < 1e-6 && Math.abs(firstY - lastY) < 1e-6) {
                normalizedPoints.pop();
            }
        }
        return normalizedPoints;
    }

    // 预计算拉出所需几何数据：参考法向量、各点法向量、绘制区域内的位移约束
    function computeDragGeometry(pathData) {
        const pointPairs = parseVertices(pathData);
        if (pointPairs.length < 2) return null;

        const basePathData = pointPairs.reduce((acc, [x, y], index) => {
            return index === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
        }, "");

        // 参考法向量：取第一条边的法向量，作为拖拽向量投影的基准轴
        let refNx = 0;
        let refNy = 0;
        {
            const dx = pointPairs[1][0] - pointPairs[0][0];
            const dy = pointPairs[1][1] - pointPairs[0][1];
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len > 0) {
                refNx = -dy / len;
                refNy = dx / len;
            }
        }

        // 绘制区域边界（对应 ocrTool.js 的 limitContainer）
        const area = getDrawingArea(svg);
        const minX = area ? area.x : -Infinity;
        const minY = area ? area.y : -Infinity;
        const maxX = area ? area.x + area.width : Infinity;
        const maxY = area ? area.y + area.height : Infinity;

        const normals = [];
        let allowedMin = -Infinity;
        let allowedMax = Infinity;
        for (let i = 0; i < pointPairs.length; i++) {
            let dx, dy;
            if (i === 0) {
                dx = pointPairs[i + 1][0] - pointPairs[i][0];
                dy = pointPairs[i + 1][1] - pointPairs[i][1];
            } else if (i === pointPairs.length - 1) {
                dx = pointPairs[i][0] - pointPairs[i - 1][0];
                dy = pointPairs[i][1] - pointPairs[i - 1][1];
            } else {
                const dx1 = pointPairs[i + 1][0] - pointPairs[i][0];
                const dy1 = pointPairs[i + 1][1] - pointPairs[i][1];
                const dx2 = pointPairs[i][0] - pointPairs[i - 1][0];
                const dy2 = pointPairs[i][1] - pointPairs[i - 1][1];
                dx = (dx1 + dx2) / 2;
                dy = (dy1 + dy2) / 2;
            }
            const length = Math.sqrt(dx * dx + dy * dy);
            const nx = length > 0 ? -dy / length : 0;
            const ny = length > 0 ? dx / length : 0;
            normals.push({ nx, ny });

            // 该点在法向量方向上允许的位移范围（保证拉出的图形不越出绘制区域）
            const x = pointPairs[i][0];
            const y = pointPairs[i][1];
            if (Math.abs(nx) > 1e-9) {
                const d1 = (minX - x) / nx;
                const d2 = (maxX - x) / nx;
                if (nx > 0) {
                    allowedMin = Math.max(allowedMin, d1);
                    allowedMax = Math.min(allowedMax, d2);
                } else {
                    allowedMin = Math.max(allowedMin, d2);
                    allowedMax = Math.min(allowedMax, d1);
                }
            }
            if (Math.abs(ny) > 1e-9) {
                const d1 = (minY - y) / ny;
                const d2 = (maxY - y) / ny;
                if (ny > 0) {
                    allowedMin = Math.max(allowedMin, d1);
                    allowedMax = Math.min(allowedMax, d2);
                } else {
                    allowedMin = Math.max(allowedMin, d2);
                    allowedMax = Math.min(allowedMax, d1);
                }
            }
        }

        return { pointPairs, normals, refNx, refNy, allowedMin, allowedMax, basePathData };
    }

    // 根据拉出距离生成闭合的不规则图形 d：
    // 基准轮廓正向 + 偏移轮廓反向 + Z 闭合
    function buildUpdatedPathData(distance) {
        if (!dragGeometry) return "";
        const { pointPairs, normals, allowedMin, allowedMax, basePathData } = dragGeometry;
        let clampedDistance = distance;
        if (allowedMin <= allowedMax) {
            clampedDistance = Math.max(allowedMin, Math.min(allowedMax, clampedDistance));
        } else {
            clampedDistance = 0;
        }
        const reversedPoints = [];
        for (let i = pointPairs.length - 1; i >= 0; i--) {
            const { nx, ny } = normals[i];
            reversedPoints.push(pointPairs[i][0] + nx * clampedDistance, pointPairs[i][1] + ny * clampedDistance);
        }
        const updatedD = reversedPoints.reduce((acc, curr, index) => {
            if (index % 2 === 0) {
                return index === 0 ? `L ${curr} ` : acc + `L ${curr} `;
            }
            return acc + `${curr} `;
        }, "").trim();
        return `${basePathData} ${updatedD} Z`;
    }

    function notifySelection() {
        if (!onSelectionChangeCallback) return;
        if (!ocrPath) {
            onSelectionChangeCallback([]);
            return;
        }
        try {
            const bbox = ocrPath.getBBox();
            onSelectionChangeCallback([{
                id: ocrPath.id,
                tagName: ocrPath.tagName,
                x: bbox.x,
                y: bbox.y,
                width: bbox.width,
                height: bbox.height,
                rotation: 0,
            }]);
        } catch {
            onSelectionChangeCallback([]);
        }
    }

    function clearGuides() {
        if (guideLine) { guideLine.remove(); guideLine = null; }
        if (startPointMarker) { startPointMarker.remove(); startPointMarker = null; }
        if (toolGroup) { toolGroup.remove(); toolGroup = null; }
    }

    // 清理本次绘制 / 拉出的所有临时状态（已提交的 ocrPath 保留）
    function resetState() {
        if (frameId) {
            cancelAnimationFrame(frameId);
            frameId = 0;
        }
        if (activePath) activePath.remove();
        if (tempPath) tempPath.remove();
        clearGuides();
        if (ocrPath && !ocrCommitted) ocrPath.remove();
        points = [];
        activePath = null;
        tempPath = null;
        ocrPath = null;
        dragGeometry = null;
        confirmed = false;
        hasCreatedShape = false;
        ocrCommitted = false;
        pendingDistance = null;
        lastAppliedPathData = "";
        notifySelection();
    }

    // ---- 阶段二：拖拽拉出 ----

    function flushPendingUpdate() {
        frameId = 0;
        if (!hasCreatedShape || pendingDistance === null) return;
        const updatedPathData = buildUpdatedPathData(pendingDistance);
        pendingDistance = null;
        if (updatedPathData !== lastAppliedPathData) {
            ocrPath?.setAttribute("d", updatedPathData);
            lastAppliedPathData = updatedPathData;
        }
    }

    function startDrag(evt) {
        initClientX = evt.clientX;
        initClientY = evt.clientY;
        hasCreatedShape = false;
        ocrCommitted = false;
        lastAppliedPathData = "";
        let hasDragged = false;

        const onMove = (mEvent) => {
            // 拖拽中按下了其他键则忽略
            if (mEvent.buttons > 2) return;
            const { clientX, clientY } = mEvent;
            const diffX = clientX - initClientX;
            const diffY = clientY - initClientY;
            if (Math.hypot(diffX, diffY) >= 4) {
                hasDragged = true;
            }

            if (!hasCreatedShape) {
                if (!hasDragged) return;
                // 首次拖动时创建拉出图形（保留与 ocrTool.js 一致的 linePolygon 类型标记）
                ocrPath = createShape("path", {
                    type: "linePolygon",
                    d: dragGeometry.basePathData,
                    fill: "rgba(24, 144, 255, 0.25)",
                    stroke: "#1890ff",
                    "stroke-width": 1,
                    "stroke-linejoin": "round",
                    "stroke-linecap": "round",
                });
                svg.appendChild(ocrPath);
                hasCreatedShape = true;
                lastAppliedPathData = dragGeometry.basePathData;
                notifySelection();
            }

            // 拖拽向量在参考法向量上的投影距离
            pendingDistance = diffX * dragGeometry.refNx + diffY * dragGeometry.refNy;
            if (!frameId) {
                frameId = requestAnimationFrame(flushPendingUpdate);
            }
        };

        const onUp = () => {
            if (frameId) {
                cancelAnimationFrame(frameId);
                flushPendingUpdate();
            }
            if (hasCreatedShape) {
                const uid = ocrPath.getAttribute("uid");
                // 提交前移除基准轮廓与引导元素，保证快照只包含最终图形
                if (tempPath) tempPath.remove();
                clearGuides();
                ocrCommitted = true;
                history.commit("拉出OCR不规则图形", { shapeType: "ocr", relatedUids: [uid] });
                resetState();
            }
            if (dragCleanup) dragCleanup();
            dragCleanup = null;
        };

        dragCleanup = () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    }

    // ---- 阶段一：逐点绘制 ----

    function onMouseDown(evt) {
        if (editor.guardMouseDown(evt)) return;

        if (evt.button === 2) {
            // 右键确认：至少 2 个点才能进入拖拽拉出模式
            if (!confirmed && activePath && countPoints(activePath.getAttribute("d")) >= 2) {
                confirmed = true;
                tempPath = activePath;
                activePath = null;
                dragGeometry = computeDragGeometry(tempPath.getAttribute("d"));
                clearGuides();
                points = [];
                // 基准轮廓降级为引导样式，拖拽结束后被移除
                tempPath.setAttribute("fill", "none");
                tempPath.setAttribute("stroke", "#1890ff");
                tempPath.setAttribute("stroke-width", "1");
                tempPath.setAttribute("stroke-dasharray", "6,3");
                tempPath.setAttribute("pointer-events", "none");
            } else if (!confirmed) {
                // 点数不足，取消本次绘制
                resetState();
            }
            evt.stopPropagation();
            evt.preventDefault();
            return;
        }

        if (evt.button !== 0) return;
        evt.stopPropagation();
        evt.preventDefault();

        if (confirmed) {
            // 右键确认后，左键按下即开始拖拽拉出
            startDrag(evt);
            return;
        }

        // 逐点打点
        const pos = getMousePos(evt);
        points.push(pos);

        if (points.length === 1) {
            activePath = createShape("path", {
                fill: "none",
                stroke: "#1890ff",
                "stroke-width": 1,
                "stroke-linejoin": "round",
                "stroke-linecap": "round",
                "pointer-events": "none",
            });
            svg.appendChild(activePath);

            toolGroup = createShape("g", { "pointer-events": "none" });
            svg.appendChild(toolGroup);

            startPointMarker = createShape("circle", {
                cx: pos.x,
                cy: pos.y,
                r: 5,
                fill: "rgba(0, 255, 0, 0.5)",
                stroke: "green",
            });
            svg.appendChild(startPointMarker);

            guideLine = createShape("line", {
                x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y,
                stroke: "green",
                "stroke-width": 1,
                "stroke-dasharray": "5,5",
            });
            toolGroup.appendChild(guideLine);
        } else {
            updatePath();
            guideLine.setAttribute("x1", pos.x);
            guideLine.setAttribute("y1", pos.y);
            guideLine.setAttribute("x2", pos.x);
            guideLine.setAttribute("y2", pos.y);
        }
    }

    function onMouseMove(evt) {
        if (!activePath || !guideLine) return;
        const pos = getMousePos(evt);
        guideLine.setAttribute("x2", pos.x);
        guideLine.setAttribute("y2", pos.y);
    }

    function onContextMenu(evt) {
        evt.preventDefault();
        evt.stopPropagation();
        return false;
    }

    // ---- 事件绑定 ----

    listeners.activate();
    listeners.on(svg, "mousedown", onMouseDown);
    listeners.on(svg, "mousemove", onMouseMove);
    listeners.on(svg, "contextmenu", onContextMenu);
    listeners.on(window, "mousemove", onMouseMove);

    return () => {
        listeners.dispose();
        if (dragCleanup) dragCleanup();
        dragCleanup = null;
        editor.dispose();
        resetState();
        setCursor(svg, "default");
        console.log("Deactivate OCR tool");
    };
}
