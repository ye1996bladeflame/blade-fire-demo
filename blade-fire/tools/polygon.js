import { setCursor, history, undoRedoManager, createShape, getToolStyle, createListenerManager, parsePathData, isClosedPolygonPath } from "../common/index.js";
import { createPathEditor } from "../common/path-editor.js";
import { clampPoint } from "../common/draw-area.js";

const SVG_NS = "http://www.w3.org/2000/svg";

// 模块级回调：由 polygon() 闭包设置，用于 undo/redo 后重建编辑手柄等视觉状态
let _onPolygonRestore = null;

// 向 undoRedoManager 注册 polygon 的 onRestore 钩子（持久存在，不随工具切换注销）
// 核心的逐点撤销/重做由 undoRedoManager 内置处理，这里仅负责视觉恢复
undoRedoManager.register("polygon", {
    onRestore(cmd, svg) {
        if (!svg) return;
        // 基本清理
        svg.querySelectorAll('g.polygon-edit-handles').forEach(el => el.remove());
        // 如果 polygon 工具激活，委托给闭包创建编辑手柄
        if (_onPolygonRestore) {
            _onPolygonRestore(cmd, svg);
            return;
        }
        // polygon 工具未激活 → 最小化：设置 data-polygon-editing
        const uid = cmd.relatedUids?.[0];
        if (uid) {
            const el = svg.querySelector(`[uid="${uid}"]`);
            if (el && isClosedPolygonPath(el)) {
                svg.querySelectorAll('[data-polygon-editing="true"]').forEach(e => e.removeAttribute('data-polygon-editing'));
                el.setAttribute("data-polygon-editing", "true");
            }
        }
    },
});

export function polygon(svg, onSelectionChangeCallback) {
    console.log("Polygon tool activated");
    if (svg) {
        setCursor(svg, "crosshair");
    }

    let points = [];
    let activePath = null;
    let toolGroup = null;
    let guideLine = null;
    let startPointMarker = null;
    let snapIndicator = null;
    let viewChangeObserver = null;

    function findSnapPoint(mousePos, snapRadius = 10) {
        const allPaths = Array.from(svg.querySelectorAll("path"));
        let closestPoint = null;
        let minDistance = Infinity;
        const CTM = svg.getScreenCTM();
        const mouseScreenX = mousePos.x * CTM.a + CTM.e;
        const mouseScreenY = mousePos.y * CTM.d + CTM.f;

        for (const path of allPaths) {
            if (path === activePath) continue;
            const d = path.getAttribute("d");
            if (!d) continue;
            const pathPoints = parsePathData(d);
            const matrix = path.getCTM();
            if (!matrix) continue;
            for (const p of pathPoints) {
                const transformedP = new DOMPoint(p.x, p.y).matrixTransform(matrix);
                const screenX = transformedP.x * CTM.a + CTM.e;
                const screenY = transformedP.y * CTM.d + CTM.f;
                const dx = screenX - mouseScreenX;
                const dy = screenY - mouseScreenY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < snapRadius && distance < minDistance) {
                    minDistance = distance;
                    closestPoint = transformedP;
                }
            }
        }
        return closestPoint;
    }

    function getMousePos(evt) {
        const CTM = svg.getScreenCTM();
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

    function resetState(removePath = true) {
        if (removePath && activePath) {
            svg.removeChild(activePath);
        }
        if (toolGroup) {
            toolGroup.remove();
            toolGroup = null;
        }
        if (startPointMarker) {
            startPointMarker.remove();
            startPointMarker = null;
        }
        guideLine = null;
        snapIndicator = null;
        if (viewChangeObserver) {
            viewChangeObserver.disconnect();
            viewChangeObserver = null;
        }
        points = [];
        activePath = null;
    }

    function closePolygon() {
        if (points.length < 3) {
            console.warn("Polygon needs at least 3 points");
            resetState();
            return;
        }

        let area = 0;
        for (let i = 0; i < points.length; i++) {
            const j = (i + 1) % points.length;
            area += points[i].x * points[j].y;
            area -= points[j].x * points[i].y;
        }
        area = Math.abs(area) / 2;

        if (area < 0.1) {
            console.warn("Polygon cannot be a straight line");
            return;
        }

        let d = activePath.getAttribute("d");
        d += " Z";
        activePath.setAttribute("d", d);
        activePath.setAttribute("fill", "transparent");

        const path = activePath;
        const uid = path.getAttribute("uid");

        // 闭合是一个新的提交点，清除该多边形的逐点重做状态（含撤销闭合的 unclosed 标记）
        undoRedoManager.clearPolygonRedoState(uid);

        // 先清理临时绘制元素（guideLine、startPointMarker 等都有 uid，
        // 会被 captureScene 捕获），再 commit，确保快照干净
        resetState(false);
        history.commit("创建多边形", { shapeType: "polygon", relatedUids: [uid] });

        editor.enterEditMode(path);
    }

    function onMouseDown(evt) {
        // 顶点手柄拖拽 / 双击第二击由通用编辑器消费
        if (editor.guardMouseDown(evt)) return;

        if (evt.button === 2) {
            if (points.length >= 3) {
                closePolygon();
            } else {
                resetState();
            }
            evt.stopPropagation();
            evt.preventDefault();
            return;
        }

        if (evt.button !== 0) return;

        let pos = getMousePos(evt);

        if (points.length >= 2) {
            const startPoint = points[0];
            const snapRadius = 10;
            const CTM = svg.getScreenCTM();
            const mouseScreen = { x: pos.x * CTM.a + CTM.e, y: pos.y * CTM.d + CTM.f };
            const startScreen = { x: startPoint.x * CTM.a + CTM.e, y: startPoint.y * CTM.d + CTM.f };
            const dx = mouseScreen.x - startScreen.x;
            const dy = mouseScreen.y - startScreen.y;

            if (Math.sqrt(dx * dx + dy * dy) < snapRadius || (startPointMarker && evt.target === startPointMarker)) {
                closePolygon();
                evt.stopPropagation();
                return;
            }
        }

        // 左键绘制开始即退出编辑模式，由通用编辑器 attach 的 mousedown 监听处理
        const externalSnapPoint = findSnapPoint(pos);
        if (externalSnapPoint) {
            pos = externalSnapPoint;
        }

        points.push(pos);
        // 清除过时的 redo 状态（用户已在撤销后修改路径）
        if (activePath) {
            undoRedoManager.clearPolygonRedoState(activePath.getAttribute("uid"));
        }

        if (points.length === 1) {
            activePath = createShape("path", {
                "stroke-linejoin": "round",
                "stroke-linecap": "round",
                ...getToolStyle("polygon"),
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
                "pointer-events": "all",
                cursor: "pointer",
            });
            svg.appendChild(startPointMarker);

            guideLine = createShape("line", {
                x1: pos.x,
                y1: pos.y,
                x2: pos.x,
                y2: pos.y,
                stroke: "green",
                "stroke-width": "1",
                "stroke-dasharray": "5,5",
            });
            toolGroup.appendChild(guideLine);

            viewChangeObserver = new MutationObserver(() => {
                if (snapIndicator) {
                    snapIndicator.setAttribute("r", 5 / (svg.getScreenCTM().a || 1));
                    snapIndicator.setAttribute("stroke-width", 2 / (svg.getScreenCTM().a || 1));
                }
            });
            viewChangeObserver.observe(svg, { attributes: true, attributeFilter: ["viewBox", "width", "height"] });
        } else {
            updatePath();
            guideLine.setAttribute("x1", pos.x);
            guideLine.setAttribute("y1", pos.y);
            guideLine.setAttribute("x2", pos.x);
            guideLine.setAttribute("y2", pos.y);
        }
    }

    function onMouseMove(evt) {
        if (!activePath) return;

        let pos = getMousePos(evt);
        const snapRadius = 10;
        let snapped = false;

        if (points.length >= 2) {
            const startPoint = points[0];
            const CTM = svg.getScreenCTM();
            const mouseScreen = { x: pos.x * CTM.a + CTM.e, y: pos.y * CTM.d + CTM.f };
            const startScreen = { x: startPoint.x * CTM.a + CTM.e, y: startPoint.y * CTM.d + CTM.f };
            const dx = mouseScreen.x - startScreen.x;
            const dy = mouseScreen.y - startScreen.y;

            if (Math.sqrt(dx * dx + dy * dy) < snapRadius) {
                pos = startPoint;
                snapped = true;
            }
        }

        if (!snapped) {
            const externalSnapPoint = findSnapPoint(pos);
            if (externalSnapPoint) {
                pos = externalSnapPoint;
                snapped = true;
            }
        }

        if (snapped) {
            if (!snapIndicator) {
                snapIndicator = createShape("circle", {
                    r: 5 / (svg.getScreenCTM().a || 1),
                    fill: "none",
                    stroke: "orange",
                    "stroke-width": 2 / (svg.getScreenCTM().a || 1),
                });
                toolGroup.appendChild(snapIndicator);
            }
            snapIndicator.setAttribute("cx", pos.x);
            snapIndicator.setAttribute("cy", pos.y);
            snapIndicator.style.display = "block";
        } else if (snapIndicator) {
            snapIndicator.style.display = "none";
        }

        guideLine.setAttribute("x2", pos.x);
        guideLine.setAttribute("y2", pos.y);
    }

    function onDblClick(evt) {
        // 双击正在绘制的多边形 → 闭合；双击已有闭合路径 → 由通用编辑器的 dblclick 监听进入编辑模式
        if (activePath && points.length >= 3) {
            closePolygon();
            evt.stopPropagation();
            evt.preventDefault();
        }
    }

    function onContextMenu(evt) {
        evt.preventDefault();
        evt.stopPropagation();
        return false;
    }

    // ---- 绘制/编辑模式切换 ----

    function switchToDrawMode(vertexPoints, path) {
        // 从编辑模式切换回绘制模式，使用已有的 path 和顶点
        editor.exitEditMode();
        const newD = vertexPoints.map((p, i) => (i === 0 ? "M" : "L") + ` ${p.x} ${p.y}`).join(" ");
        path.setAttribute("d", newD);
        path.setAttribute("fill", "none");

        points = vertexPoints;
        activePath = path;

        const lastPoint = points[points.length - 1];
        toolGroup = createShape("g", { "pointer-events": "none" });
        svg.appendChild(toolGroup);
        startPointMarker = createShape("circle", {
            cx: points[0].x, cy: points[0].y, r: 5,
            fill: "rgba(0, 255, 0, 0.5)", stroke: "green",
            "pointer-events": "all", cursor: "pointer",
        });
        svg.appendChild(startPointMarker);
        guideLine = createShape("line", {
            x1: lastPoint.x, y1: lastPoint.y,
            x2: lastPoint.x, y2: lastPoint.y,
            stroke: "green", "stroke-width": "1", "stroke-dasharray": "5,5",
        });
        toolGroup.appendChild(guideLine);
        viewChangeObserver = new MutationObserver(() => {
            if (snapIndicator) {
                snapIndicator.setAttribute("r", 5 / (svg.getScreenCTM().a || 1));
                snapIndicator.setAttribute("stroke-width", 2 / (svg.getScreenCTM().a || 1));
            }
        });
        viewChangeObserver.observe(svg, { attributes: true, attributeFilter: ["viewBox", "width", "height"] });
    }

    // ---- undo/redo 闭包处理器（仅用于 onRestore 时创建编辑手柄） ----

    _onPolygonRestore = (cmd, svg) => {
        const editingEl = editor.getEditingPath();
        if (editingEl) {
            const uid = editingEl.getAttribute("uid");
            const el = svg.querySelector(`[uid="${uid}"]`);
            if (el && isClosedPolygonPath(el)) {
                editor.enterEditMode(el);
            } else {
                editor.exitEditMode();
            }
            return;
        }
        if (!activePath && !points.length) {
            const el = svg.querySelector('[data-polygon-editing="true"]');
            if (el && isClosedPolygonPath(el)) {
                editor.enterEditMode(el);
            }
        }
    };

    // ---- 键盘事件（统一处理所有逐点撤销/重做） ----
    // 注册在 document 捕获阶段，确保先于全局 window 上的 keydown 触发
    // 编辑模式：委托 undoRedoManager.undo/redo 处理核心逻辑，仅做视觉反馈
    // 绘制模式：本地弹出/恢复顶点（无 history commit），redo 状态通过 pushPolygonRedoPoint 管理
    // 无本地状态：仍尝试 undoRedoManager 处理任意多边形的逐点撤销并进入绘制模式

    function onKeyDown(evt) {
        const isCtrlZ = (evt.ctrlKey || evt.metaKey) && evt.key.toLowerCase() === "z";
        if (!isCtrlZ) return;

        const isRedo = evt.shiftKey;

        // ── Ctrl+Shift+Z: 逐点重做 ──
        if (isRedo) {
            const result = undoRedoManager.redo(svg);
            if (result?.type === "polygon-redo") {
                const { uid, newPoints, closed } = result;
                if (closed) {
                    // 所有点已恢复且已闭合 → 进入编辑模式
                    const path = svg.querySelector(`[uid="${uid}"]`);
                    if (path && isClosedPolygonPath(path)) {
                        if (activePath) resetState(false);
                        editor.enterEditMode(path);
                    }
                } else if (activePath && activePath.getAttribute("uid") === uid) {
                    // 在绘制模式中且是同一多边形 → 同步本地状态和引导线
                    points = newPoints;
                    updatePath();
                    if (guideLine) {
                        const lastPoint = points[points.length - 1];
                        guideLine.setAttribute("x1", lastPoint.x);
                        guideLine.setAttribute("y1", lastPoint.y);
                        guideLine.setAttribute("x2", lastPoint.x);
                        guideLine.setAttribute("y2", lastPoint.y);
                    }
                } else if (newPoints.length > 0) {
                    // 不在绘制模式或不是同一多边形 → 切换到该多边形的绘制模式
                    const path = svg.querySelector(`[uid="${uid}"]`);
                    if (path) {
                        editor.exitEditMode();
                        if (activePath) resetState(true);
                        switchToDrawMode(newPoints, path);
                    }
                }
                evt.stopImmediatePropagation();
                evt.preventDefault();
                return;
            }
            // 非 polygon 重做 → 放行给全局 handler
            return;
        }

        // ── Ctrl+Z: 编辑模式逐点撤销 → 委托 undoRedoManager ──
        if (editingPath) {
            const editingUid = editingPath.getAttribute("uid");
            const result = undoRedoManager.undo(svg, editingUid);
            if (result?.type === "polygon-undo") {
                const path = svg.querySelector(`[uid="${result.uid}"]`) || editingPath;
                if (result.remainingPoints.length > 0) {
                    switchToDrawMode(result.remainingPoints, path);
                } else {
                    exitEditMode();
                    if (path && path.parentNode) path.remove();
                }
                evt.stopImmediatePropagation();
                evt.preventDefault();
                return;
            }
            if (result === true) {
                exitEditMode();
                evt.stopImmediatePropagation();
                evt.preventDefault();
                return;
            }
        }

        // ── Ctrl+Z: 绘制模式逐点撤销（无 history commit，本地处理） ──
        if (activePath && points.length > 0) {
            const uid = activePath.getAttribute("uid");
            const popped = points[points.length - 1];
            points.pop();

            // 存储到 undoRedoManager 的 LIFO redo 状态
            undoRedoManager.pushPolygonRedoPoint(uid, popped);

            if (points.length === 0) {
                activePath.setAttribute("d", "");
                const emptyPath = activePath;
                resetState(false);
                // d 已无数据，清理残留的空 path 元素
                if (emptyPath && emptyPath.parentNode) {
                    emptyPath.parentNode.removeChild(emptyPath);
                }
            } else {
                updatePath();
                if (guideLine) {
                    const lastPoint = points[points.length - 1];
                    guideLine.setAttribute("x1", lastPoint.x);
                    guideLine.setAttribute("y1", lastPoint.y);
                    guideLine.setAttribute("x2", lastPoint.x);
                    guideLine.setAttribute("y2", lastPoint.y);
                }
            }
            evt.stopImmediatePropagation();
            evt.preventDefault();
            return;
        }

        // ── Ctrl+Z: 无本地状态时仍尝试 undoRedoManager（处理其他已提交的多边形）──
        // 例如：绘制模式撤销完所有顶点后，继续 Ctrl+Z 应撤销上一个已闭合的多边形
        {
            const result = undoRedoManager.undo(svg);
            if (result?.type === "polygon-undo") {
                const path = svg.querySelector(`[uid="${result.uid}"]`);
                if (path && result.remainingPoints.length > 0) {
                    switchToDrawMode(result.remainingPoints, path);
                } else if (path) {
                    path.remove();
                }
                evt.stopImmediatePropagation();
                evt.preventDefault();
                return;
            }
            if (result === true) {
                evt.stopImmediatePropagation();
                evt.preventDefault();
                return;
            }
        }

        // 非 polygon 相关操作 → 放行给全局 handler
    }

    // ---- 事件绑定 ----

    const listeners = createListenerManager();
    listeners.on(svg, "mousedown", onMouseDown);
    listeners.on(svg, "mousemove", onMouseMove);
    listeners.on(svg, "dblclick", onDblClick);
    listeners.on(svg, "contextmenu", onContextMenu);
    listeners.on(window, "mousemove", onMouseMove);
    listeners.on(window, "mouseup", onVertexDragUp);
    // 必须在 document 捕获阶段注册，确保在全局 window keydown（冒泡阶段）之前触发
    // 否则 window 上的 handler 注册顺序会导致全局先触发 → undoRedoManager → 重复弹点
    listeners.on(document, "keydown", onKeyDown, { capture: true });

    // 激活时自动检测需要编辑的闭合多边形（如 undo/redo 切换工具后）
    const editingEl = svg.querySelector('[data-polygon-editing="true"]');
    if (editingEl && isClosedPolygonPath(editingEl)) {
        enterEditMode(editingEl);
    }

    return () => {
        listeners.dispose();
        _onPolygonRestore = null;

        if (activePath) {
            resetState();
        }
        exitEditMode();

        // 断开 viewChangeObserver（兜底，避免 activePath 为 null 时未清理）
        if (viewChangeObserver) {
            viewChangeObserver.disconnect();
            viewChangeObserver = null;
        }

        // 强制清理残留的编辑状态 DOM（兜底，确保切换工具后不留痕迹）
        svg.querySelectorAll('[data-polygon-editing="true"]').forEach(el => {
            el.removeAttribute('data-polygon-editing');
        });
        svg.querySelectorAll('g.polygon-edit-handles').forEach(el => el.remove());

        console.log("Deactivate polygon tool");
    };
}
