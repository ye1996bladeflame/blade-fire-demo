import { createListenerManager } from './listeners.js';
import { createShape } from './element.js';
import { parsePathData, buildPathData, isClosedPolygonPath } from './path-utils.js';
import { parseTransform } from './transform.js';
import { clampPoint } from './draw-area.js';
import { history } from './history.js';

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * 通用路径图形"双击编辑"能力。
 *
 * 任何以 <path> 生成的闭合图形（polygon / triangle / path-rect / path-ellipse /
 * ocr / freehand 等）都可以复用本模块，双击即可进入编辑模式：
 *
 * - 在图形上设置编辑标记属性（默认 data-polygon-editing="true"，可通过 editAttr 覆盖）
 * - 选中该图形：通过 onSelectionChange 通知（驱动右侧属性面板）
 * - 在顶点处显示可拖拽的编辑手柄，拖拽顶点实时更新 path 的 d
 * - 与"左键绘制"互不干扰：单击绘制逻辑原样保留，仅双击触发编辑；
 *   双击的第二击会被 guardMouseDown 拦截，不会误开始绘制
 *
 * 工具内集成示例：
 *   const editor = createPathEditor(svg, {
 *       onSelectionChange,
 *       onIsDrawing: () => isDrawing,
 *       historyDesc: '调整三角形顶点',
 *       historyShapeType: 'triangle',
 *   });
 *   editor.attach();                        // 注册内部监听（dblclick / mousedown / 顶点拖拽）
 *   function onMouseDown(evt) {
 *       if (editor.guardMouseDown(evt)) return;   // 顶点拖拽开始 / 双击第二击
 *       ...原有绘制逻辑...
 *   }
 *   工具停用时：editor.dispose();
 */
export function createPathEditor(svg, options = {}) {
    const {
        onSelectionChange,
        editAttr = 'data-polygon-editing',
        handleGroupClass = 'polygon-edit-handles',
        canEdit = (el) => isClosedPolygonPath(el),
        onIsDrawing = null,
        historyDesc = '调整路径顶点',
        historyShapeType = 'path',
    } = options;

    const listeners = createListenerManager();

    let editingPath = null;
    let editGroup = null;
    let isDraggingVertex = false;
    let dragVertexIndex = -1;
    let dragInitPoints = [];
    let dragInitTransform = '';
    let vertexDragStart = { x: 0, y: 0 };
    let prevCursor = '';

    function getPathBounds(path) {
        try {
            const bbox = path.getBBox();
            let matrix = svg.createSVGMatrix();
            if (path.transform && path.transform.baseVal.numberOfItems > 0) {
                for (let i = 0; i < path.transform.baseVal.numberOfItems; i++) {
                    matrix = matrix.multiply(path.transform.baseVal.getItem(i).matrix);
                }
            }
            const pts = [
                new DOMPoint(bbox.x, bbox.y),
                new DOMPoint(bbox.x + bbox.width, bbox.y),
                new DOMPoint(bbox.x + bbox.width, bbox.y + bbox.height),
                new DOMPoint(bbox.x, bbox.y + bbox.height),
            ];
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            pts.forEach((pt) => {
                const t = pt.matrixTransform(matrix);
                minX = Math.min(minX, t.x);
                minY = Math.min(minY, t.y);
                maxX = Math.max(maxX, t.x);
                maxY = Math.max(maxY, t.y);
            });
            return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
        } catch {
            return { x: 0, y: 0, width: 0, height: 0 };
        }
    }

    function notifySelection() {
        if (!onSelectionChange) return;
        if (!editingPath) {
            onSelectionChange([]);
            return;
        }
        const bounds = getPathBounds(editingPath);
        const transform = editingPath.getAttribute("transform") || "";
        onSelectionChange([{
            id: editingPath.id,
            tagName: editingPath.tagName,
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height,
            rotation: parseTransform(transform).rotate || 0,
        }]);
    }

    function getMousePos(evt) {
        const CTM = svg.getScreenCTM();
        if (!CTM) return { x: 0, y: 0 };
        // 坐标限制在绘制区域内
        return clampPoint(svg, (evt.clientX - CTM.e) / CTM.a, (evt.clientY - CTM.f) / CTM.d);
    }

    function createEditHandles() {
        if (editGroup && editGroup.parentNode) {
            editGroup.parentNode.removeChild(editGroup);
        }
        editGroup = document.createElementNS(SVG_NS, "g");
        editGroup.setAttribute("class", handleGroupClass);
        const transform = editingPath.getAttribute("transform");
        if (transform) {
            editGroup.setAttribute("transform", transform);
        }
        const vertexPoints = parsePathData(editingPath.getAttribute("d"));
        const handleSize = 8;
        vertexPoints.forEach((p, index) => {
            const handle = createShape("circle", {
                cx: p.x,
                cy: p.y,
                r: handleSize / 2,
                fill: "white",
                stroke: "#1890ff",
                "stroke-width": 1,
                cursor: "move",
            });
            handle.dataset.type = "vertex";
            handle.dataset.index = String(index);
            editGroup.appendChild(handle);
        });
        svg.appendChild(editGroup);
    }

    function enterEditMode(path) {
        if (!path || !canEdit(path)) return false;
        exitEditMode();
        editingPath = path;
        path.setAttribute(editAttr, "true");
        // 同一时刻只允许一个图形处于编辑模式
        svg.querySelectorAll(`[${editAttr}="true"]`).forEach((el) => {
            if (el !== path) el.removeAttribute(editAttr);
        });
        createEditHandles();
        notifySelection();
        return true;
    }

    function exitEditMode() {
        if (editGroup && editGroup.parentNode) {
            editGroup.parentNode.removeChild(editGroup);
        }
        editGroup = null;
        if (editingPath) {
            editingPath.removeAttribute(editAttr);
        }
        editingPath = null;
        isDraggingVertex = false;
        dragVertexIndex = -1;
        notifySelection();
    }

    function isEditing() {
        return !!editingPath;
    }

    function getEditingPath() {
        return editingPath;
    }

    /**
     * 工具 onMouseDown 的守卫：
     * - 编辑模式下点击顶点手柄 → 开始拖拽顶点
     * - 双击的第二击 → 不触发绘制（由随后的 dblclick 进入编辑模式）
     * 返回 true 表示本次 mousedown 已被消费，工具不应继续走绘制逻辑。
     */
    function guardMouseDown(evt) {
        if (evt.button !== 0) return false;

        if (editGroup && editGroup.contains(evt.target) && evt.target.dataset?.type === "vertex") {
            isDraggingVertex = true;
            dragVertexIndex = parseInt(evt.target.dataset.index, 10);
            dragInitPoints = parsePathData(editingPath.getAttribute("d"));
            dragInitTransform = editingPath.getAttribute("transform") || "";
            vertexDragStart = getMousePos(evt);
            prevCursor = svg.style.cursor;
            svg.style.cursor = "move";
            evt.stopPropagation();
            evt.preventDefault();
            return true;
        }

        // 双击的第二击不开始绘制
        if (evt.detail >= 2) {
            evt.stopPropagation();
            evt.preventDefault();
            return true;
        }

        return false;
    }

    function handleMouseMove(evt) {
        if (!isDraggingVertex || !editingPath) return;
        const pos = getMousePos(evt);
        const tData = parseTransform(dragInitTransform);
        const dx = pos.x - vertexDragStart.x;
        const dy = pos.y - vertexDragStart.y;

        let ldx = dx;
        let ldy = dy;
        if (tData.rotate) {
            const rad = (-tData.rotate * Math.PI) / 180;
            ldx = dx * Math.cos(rad) - dy * Math.sin(rad);
            ldy = dx * Math.sin(rad) + dy * Math.cos(rad);
        }
        ldx /= tData.sx || 1;
        ldy /= tData.sy || 1;

        const newPoints = dragInitPoints.map((p, i) => {
            if (i === dragVertexIndex) {
                return { x: p.x + ldx, y: p.y + ldy };
            }
            return p;
        });

        editingPath.setAttribute("d", buildPathData(newPoints));
        const handle = editGroup?.querySelector(`[data-index="${dragVertexIndex}"]`);
        if (handle) {
            handle.setAttribute("cx", newPoints[dragVertexIndex].x);
            handle.setAttribute("cy", newPoints[dragVertexIndex].y);
        }
        notifySelection();
    }

    function handleMouseUp() {
        if (!isDraggingVertex || !editingPath) return;

        const newD = editingPath.getAttribute("d");
        const oldD = buildPathData(dragInitPoints);
        if (newD !== oldD) {
            history.commit(historyDesc, {
                shapeType: historyShapeType,
                relatedUids: [editingPath.getAttribute("uid")],
            });
        }

        isDraggingVertex = false;
        dragVertexIndex = -1;
        svg.style.cursor = prevCursor;
        prevCursor = '';
    }

    function handleDblClick(evt) {
        if (onIsDrawing && onIsDrawing()) return false;
        const target = evt.target;
        if (target && target.tagName === "path" && canEdit(target)) {
            return enterEditMode(target);
        }
        return false;
    }

    /**
     * 注册内部监听：
     * - dblclick → 进入编辑模式
     * - mousedown → 点击非手柄区域时退出编辑模式（左键绘制开始时）
     * - window mousemove/mouseup → 顶点拖拽
     */
    function attach() {
        listeners.activate();
        listeners.on(svg, "dblclick", (evt) => {
            if (handleDblClick(evt)) {
                evt.stopPropagation();
                evt.preventDefault();
            }
        });
        listeners.on(svg, "mousedown", (evt) => {
            if (!editingPath) return;
            // 顶点手柄上的按下交给工具自身的 guardMouseDown 处理拖拽
            if (editGroup && editGroup.contains(evt.target)) return;
            // 其余左键按下视为开始绘制/交互，退出编辑模式
            if (evt.button === 0) exitEditMode();
        });
        listeners.on(window, "mousemove", handleMouseMove);
        listeners.on(window, "mouseup", handleMouseUp);
    }

    function dispose() {
        listeners.dispose();
        exitEditMode();
    }

    return {
        attach,
        dispose,
        guardMouseDown,
        enterEditMode,
        exitEditMode,
        isEditing,
        getEditingPath,
    };
}
