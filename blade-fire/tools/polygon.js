import { setCursor, history, createShape, getToolStyle, parseTransform } from "../common/index.js";

const SVG_NS = "http://www.w3.org/2000/svg";

function parsePathData(d) {
    if (!d) return [];
    const points = [];
    const commands = d.match(/[MmLlHhVv][^MmLlHhVv]*/g) || [];
    let currentPos = { x: 0, y: 0 };
    commands.forEach((cmdStr) => {
        const type = cmdStr[0];
        const args = cmdStr.slice(1).trim().split(/[\s,]+/).map(parseFloat).filter((n) => !isNaN(n));
        if (type === "M" || type === "L") {
            for (let i = 0; i < args.length; i += 2) {
                currentPos = { x: args[i], y: args[i + 1] };
                points.push(currentPos);
            }
        } else if (type === "m" || type === "l") {
            for (let i = 0; i < args.length; i += 2) {
                currentPos.x += args[i];
                currentPos.y += args[i + 1];
                points.push({ ...currentPos });
            }
        }
    });
    const finalPoints = [];
    const uniquePoints = new Set();
    for (const p of points) {
        const key = `${p.x},${p.y}`;
        if (!uniquePoints.has(key)) {
            uniquePoints.add(key);
            finalPoints.push(p);
        }
    }
    if (finalPoints.length > 2) {
        const first = finalPoints[0];
        const last = finalPoints[finalPoints.length - 1];
        if (first.x === last.x && first.y === last.y) {
            finalPoints.pop();
        }
    }
    return finalPoints;
}

function buildPathData(points) {
    if (!points || points.length === 0) return "";
    const d = points.map((p, i) => (i === 0 ? "M" : "L") + ` ${p.x} ${p.y}`).join(" ");
    return d + " Z";
}

function isClosedPolygonPath(el) {
    if (!el || el.tagName !== "path") return false;
    const d = el.getAttribute("d");
    return d && /Z\s*$/i.test(d.trim());
}

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

    // Edit mode state — only one polygon at a time
    let editingPath = null;
    let editGroup = null;
    let isDraggingVertex = false;
    let dragVertexIndex = -1;
    let dragInitPoints = [];
    let dragInitTransform = "";

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
        if (!onSelectionChangeCallback) return;
        if (!editingPath) {
            onSelectionChangeCallback([]);
            return;
        }
        const bounds = getPathBounds(editingPath);
        const transform = editingPath.getAttribute("transform") || "";
        onSelectionChangeCallback([{
            id: editingPath.id,
            tagName: editingPath.tagName,
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height,
            rotation: parseTransform(transform).rotate || 0,
        }]);
    }

    function exitEditMode() {
        if (editGroup && editGroup.parentNode) {
            editGroup.parentNode.removeChild(editGroup);
        }
        editGroup = null;
        if (editingPath) {
            editingPath.removeAttribute("data-polygon-editing");
        }
        editingPath = null;
        isDraggingVertex = false;
        dragVertexIndex = -1;
        notifySelection();
    }

    function createEditHandles() {
        if (editGroup && editGroup.parentNode) {
            editGroup.parentNode.removeChild(editGroup);
        }
        editGroup = document.createElementNS(SVG_NS, "g");
        editGroup.setAttribute("class", "polygon-edit-handles");
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
        if (!path || !isClosedPolygonPath(path)) return;
        exitEditMode();
        editingPath = path;
        editingPath.setAttribute("data-polygon-editing", "true");
        createEditHandles();
        notifySelection();
    }

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
        return {
            x: (evt.clientX - CTM.e) / CTM.a,
            y: (evt.clientY - CTM.f) / CTM.d,
        };
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
        history.push({
            desc: "创建多边形",
            undo: () => {
                if (path && path.parentNode) {
                    path.remove();
                }
                if (editingPath === path) {
                    exitEditMode();
                }
            },
            redo: () => {
                let rd = path.getAttribute("d");
                if (!rd.match(/Z\s*$/i)) rd += " Z";
                path.setAttribute("d", rd);
                path.setAttribute("fill", "transparent");
                svg.appendChild(path);
            },
        });

        resetState(false);
        enterEditMode(path);
    }

    function onEditMouseDown(evt) {
        if (evt.button !== 0) return;
        const target = evt.target;
        if (!editGroup || !editGroup.contains(target) || target.dataset.type !== "vertex") {
            return false;
        }
        isDraggingVertex = true;
        dragVertexIndex = parseInt(target.dataset.index, 10);
        dragInitPoints = parsePathData(editingPath.getAttribute("d"));
        dragInitTransform = editingPath.getAttribute("transform") || "";
        setCursor(svg, "move");
        evt.stopPropagation();
        evt.preventDefault();
        return true;
    }

    let vertexDragStart = { x: 0, y: 0 };

    function onVertexDragMove(evt) {
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
        const handle = editGroup.querySelector(`[data-index="${dragVertexIndex}"]`);
        if (handle) {
            handle.setAttribute("cx", newPoints[dragVertexIndex].x);
            handle.setAttribute("cy", newPoints[dragVertexIndex].y);
        }
        notifySelection();
    }

    function onVertexDragUp() {
        if (!isDraggingVertex || !editingPath) return;

        const newD = editingPath.getAttribute("d");
        const oldD = buildPathData(dragInitPoints);
        if (newD !== oldD) {
            history.push({
                desc: "调整多边形顶点",
                undo: () => {
                    editingPath.setAttribute("d", oldD);
                    createEditHandles();
                    notifySelection();
                },
                redo: () => {
                    editingPath.setAttribute("d", newD);
                    createEditHandles();
                    notifySelection();
                },
            });
        }

        isDraggingVertex = false;
        dragVertexIndex = -1;
        setCursor(svg, "crosshair");
    }

    function onMouseDown(evt) {
        if (onEditMouseDown(evt)) {
            vertexDragStart = getMousePos(evt);
            return;
        }

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

        // Double-click second mousedown should not add a point or start new draw
        if (evt.detail >= 2) {
            return;
        }

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

        // Starting a new polygon — clear previous edit mode
        if (points.length === 0) {
            exitEditMode();
        }

        const externalSnapPoint = findSnapPoint(pos);
        if (externalSnapPoint) {
            pos = externalSnapPoint;
        }

        points.push(pos);

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
        if (isDraggingVertex) {
            onVertexDragMove(evt);
            return;
        }

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
        if (activePath && points.length >= 3) {
            closePolygon();
            evt.stopPropagation();
            evt.preventDefault();
            return;
        }

        const target = evt.target;
        if (isClosedPolygonPath(target) && target !== activePath) {
            enterEditMode(target);
            evt.stopPropagation();
            evt.preventDefault();
        }
    }

    function onContextMenu(evt) {
        evt.preventDefault();
        evt.stopPropagation();
        return false;
    }

    function onKeyDown(evt) {
        if ((evt.ctrlKey || evt.metaKey) && evt.key.toLowerCase() === "z" && !evt.shiftKey) {
            if (activePath && points.length > 0) {
                points.pop();
                if (points.length < 2) {
                    resetState();
                } else {
                    updatePath();
                    if (guideLine) {
                        const lastPoint = points[points.length - 1];
                        guideLine.setAttribute("x1", lastPoint.x);
                        guideLine.setAttribute("y1", lastPoint.y);
                    }
                }
                evt.stopPropagation();
                evt.preventDefault();
            }
        }
    }

    svg.addEventListener("mousedown", onMouseDown);
    svg.addEventListener("mousemove", onMouseMove);
    svg.addEventListener("dblclick", onDblClick);
    svg.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onVertexDragUp);
    window.addEventListener("keydown", onKeyDown, true);

    return () => {
        svg.removeEventListener("mousedown", onMouseDown);
        svg.removeEventListener("mousemove", onMouseMove);
        svg.removeEventListener("dblclick", onDblClick);
        svg.removeEventListener("contextmenu", onContextMenu);
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onVertexDragUp);
        window.removeEventListener("keydown", onKeyDown, true);

        if (activePath) {
            resetState();
        }
        exitEditMode();
        console.log("Deactivate polygon tool");
    };
}
