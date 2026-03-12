import { setCursor, getOverlayLayer, history } from "../common/index.js";

const SVG_NS = "http://www.w3.org/2000/svg";

export function polygon(svg) {
    console.log("Polygon tool activated");
    if (svg) {
        setCursor(svg, "crosshair");
    }

    // State
    let isToolActive = true;
    let points = [];
    let activePath = null;
    let toolGroup = null;
    let guideLine = null;
    let startPointMarker = null; // Visual indicator for the start point
    let snapIndicator = null; // Visual for snap point
    let viewChangeObserver = null;
    let lastMouseMoveEvent = null;

    function restoreDrawingState(savedPoints, path) {
        points = savedPoints;
        activePath = path;

        // Recreate tool group and helpers
        toolGroup = createSVGElement("g", { "pointer-events": "none" });
        svg.appendChild(toolGroup);

        const startPoint = points[0];
        startPointMarker = createSVGElement("circle", {
            "cx": startPoint.x,
            "cy": startPoint.y,
            "r": 5,
            "fill": "rgba(0, 255, 0, 0.5)",
            "stroke": "green",
            "pointer-events": "all",
            "cursor": "pointer"
        });
        svg.appendChild(startPointMarker); // Append to svg to catch events

        const lastPoint = points[points.length - 1];
        guideLine = createSVGElement("line", {
            "x1": lastPoint.x,
            "y1": lastPoint.y,
            "x2": lastPoint.x,
            "y2": lastPoint.y,
            "stroke": "green",
            "stroke-width": "1",
            "stroke-dasharray": "5,5"
        });
        toolGroup.appendChild(guideLine);

        // Observe view changes
        if (viewChangeObserver) viewChangeObserver.disconnect();
        viewChangeObserver = new MutationObserver(() => {
            if (snapIndicator) {
                snapIndicator.setAttribute("r", 5 / (svg.getScreenCTM().a || 1));
                snapIndicator.setAttribute("stroke-width", 2 / (svg.getScreenCTM().a || 1));
            }
        });
        viewChangeObserver.observe(svg, { attributes: true, attributeFilter: ['viewBox', 'width', 'height'] });
    }

    // Find the nearest vertex to snap to
    function findSnapPoint(mousePos, snapRadius = 10) {
        const allPaths = Array.from(svg.querySelectorAll('path'));
        let closestPoint = null;
        let minDistance = Infinity;

        const CTM = svg.getScreenCTM();
        const mouseScreenX = mousePos.x * CTM.a + CTM.e;
        const mouseScreenY = mousePos.y * CTM.d + CTM.f;

        for (const path of allPaths) {
            if (path === activePath) continue; // Don't snap to the active path
            const d = path.getAttribute('d');
            if (!d) continue;

            // Simplified parser for "M x,y L x,y ..."
            const commands = d.match(/[MmLlHhVv][^MmLlHhVv]*/g) || [];
            let currentPos = { x: 0, y: 0 };
            const points = [];
            commands.forEach(cmdStr => {
                const type = cmdStr[0];
                const args = cmdStr.slice(1).trim().split(/[\s,]+/).map(parseFloat).filter(n => !isNaN(n));
                if (type === 'M' || type === 'L') {
                    for (let i = 0; i < args.length; i += 2) {
                        currentPos = { x: args[i], y: args[i+1] };
                        points.push(currentPos);
                    }
                } else if (type === 'm' || type === 'l') {
                    for (let i = 0; i < args.length; i += 2) {
                        currentPos.x += args[i];
                        currentPos.y += args[i+1];
                        points.push({...currentPos});
                    }
                }
            });

            const transform = path.getAttribute('transform');
            const matrix = new DOMMatrix(transform || '');

            for (const p of points) {
                const transformedP = new DOMPoint(p.x, p.y).matrixTransform(matrix);
                
                // Convert to screen coordinates to calculate distance
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
    
    // Helper: Get SVG coordinates
    function getMousePos(evt) {
        const CTM = svg.getScreenCTM();
        return {
            x: (evt.clientX - CTM.e) / CTM.a,
            y: (evt.clientY - CTM.f) / CTM.d
        };
    }

    // Helper: Create SVG element
    function createSVGElement(tag, attrs = {}) {
        const el = document.createElementNS(SVG_NS, tag);
        for (const [key, value] of Object.entries(attrs)) {
            el.setAttribute(key, value);
        }
        return el;
    }

    // Update the path 'd' attribute based on current points
    function updatePath() {
        if (!activePath || points.length === 0) return;
        
        let d = `M ${points[0].x} ${points[0].y}`;
        for (let i = 1; i < points.length; i++) {
            d += ` L ${points[i].x} ${points[i].y}`;
        }
        activePath.setAttribute("d", d);
    }

    // Finish and close the polygon
    function closePolygon() {
        if (points.length < 3) {
            console.warn("Polygon needs at least 3 points");
            resetState();
            return;
        }

        // Check for collinearity (simplified area check)
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

        // Close the path
        let d = activePath.getAttribute("d");
        d += " Z";
        activePath.setAttribute("d", d);
        activePath.setAttribute("fill", "transparent");
        
        const savedPoints = [...points];
        const path = activePath;
        
        history.push({
            undo: () => {
                if (isToolActive) {
                    // Restore activePath ref
                    activePath = path;
                    
                    // Restore drawing state
                    restoreDrawingState(savedPoints, path);
                    
                    // Open the path (remove Z)
                    let d = path.getAttribute("d");
                    if (d.match(/Z\s*$/i)) {
                         d = d.replace(/\s*Z\s*$/i, "");
                         path.setAttribute("d", d);
                    }
                    path.setAttribute("fill", "none");
                } else {
                    path.remove();
                }
            },
            redo: () => {
                if (isToolActive) {
                     // Close again
                     let d = path.getAttribute("d");
                     if (!d.match(/Z\s*$/i)) d += " Z";
                     path.setAttribute("d", d);
                     path.setAttribute("fill", "transparent");
                     
                     resetState(false);
                } else {
                     svg.appendChild(path);
                }
            }
        });

        resetState(false); // false = don't remove the path element
    }

    function resetState(removePath = true) {
        if (removePath && activePath) {
            svg.removeChild(activePath);
        }
        if (toolGroup) {
            toolGroup.remove();
            toolGroup = null;
        }
        // Properly remove startPointMarker from DOM
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
        lastMouseMoveEvent = null;
    }

    function onMouseDown(evt) {
        // Right click handling
        if (evt.button === 2) {
            if (points.length >= 3) {
                closePolygon();
            } else {
                // Cancel drawing if less than 3 points
                resetState();
            }
            evt.stopPropagation();
            evt.preventDefault();
            return;
        }

        if (evt.button !== 0) return;

        let pos = getMousePos(evt);

        // Check for closing action (priority 1)
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

        // If not closing, check for other snaps (priority 2)
        const externalSnapPoint = findSnapPoint(pos);
        if (externalSnapPoint) {
            pos = externalSnapPoint;
        }

        points.push(pos);

        if (points.length === 1) {
            // Start new polygon
            activePath = createSVGElement("path", {
                "stroke": "green",
                "stroke-width": "1",
                "fill": "none",
                "stroke-linejoin": "round",
                "stroke-linecap": "round"
            });
            svg.appendChild(activePath);
            
            // Create tool group for helpers
            toolGroup = createSVGElement("g", { "pointer-events": "none" });
            svg.appendChild(toolGroup);

            // Start point marker
            startPointMarker = createSVGElement("circle", {
                "cx": pos.x,
                "cy": pos.y,
                "r": 5,
                "fill": "rgba(0, 255, 0, 0.5)",
                "stroke": "green",
                "pointer-events": "all",
                "cursor": "pointer"
            });
            svg.appendChild(startPointMarker); // Append to svg to catch events

            // Guide line
            guideLine = createSVGElement("line", {
                "x1": pos.x,
                "y1": pos.y,
                "x2": pos.x,
                "y2": pos.y,
                "stroke": "green",
                "stroke-width": "1",
                "stroke-dasharray": "5,5"
            });
            toolGroup.appendChild(guideLine);

            // Observe view changes
            viewChangeObserver = new MutationObserver(() => {
                if (snapIndicator) {
                    snapIndicator.setAttribute("r", 5 / (svg.getScreenCTM().a || 1));
                    snapIndicator.setAttribute("stroke-width", 2 / (svg.getScreenCTM().a || 1));
                }
            });
            viewChangeObserver.observe(svg, { attributes: true, attributeFilter: ['viewBox', 'width', 'height'] });

        } else {
            updatePath();
            // Update guide line start
            guideLine.setAttribute("x1", pos.x);
            guideLine.setAttribute("y1", pos.y);
            guideLine.setAttribute("x2", pos.x);
            guideLine.setAttribute("y2", pos.y);
        }
    }

    function onMouseMove(evt) {
        lastMouseMoveEvent = evt;
        if (!activePath) return;

        let pos = getMousePos(evt);
        
        // Snapping logic for guide line end
        const snapRadius = 10;
        let snapped = false;

        // 1. Snap to start point
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

        // 2. Snap to external vertices
        if (!snapped) {
            const externalSnapPoint = findSnapPoint(pos);
            if (externalSnapPoint) {
                pos = externalSnapPoint;
                snapped = true;
            }
        }

        // Update snap indicator
        if (snapped) {
            if (!snapIndicator) {
                snapIndicator = createSVGElement("circle", {
                    "r": 5 / (svg.getScreenCTM().a || 1),
                    "fill": "none",
                    "stroke": "orange",
                    "stroke-width": 2 / (svg.getScreenCTM().a || 1)
                });
                toolGroup.appendChild(snapIndicator);
            }
            snapIndicator.setAttribute("cx", pos.x);
            snapIndicator.setAttribute("cy", pos.y);
            snapIndicator.style.display = "block";
        } else if (snapIndicator) {
            snapIndicator.style.display = "none";
        }

        // Update guide line
        guideLine.setAttribute("x2", pos.x);
        guideLine.setAttribute("y2", pos.y);
    }

    function onDblClick(evt) {
        // Double click to close
        closePolygon();
    }

    function onContextMenu(evt) {
        evt.preventDefault();
        evt.stopPropagation();
        return false;
    }

    function onKeyDown(evt) {
        // Check for Undo (Ctrl+Z)
        if ((evt.ctrlKey || evt.metaKey) && evt.key.toLowerCase() === 'z' && !evt.shiftKey) {
            if (activePath && points.length > 0) {
                // Remove last point
                points.pop();
                
                if (points.length < 2) {
                    // Cancel drawing if less than 2 points left (avoid single point state)
                    resetState();
                } else {
                    // Redraw path
                    let d = `M ${points[0].x} ${points[0].y}`;
                    for (let i = 1; i < points.length; i++) {
                        d += ` L ${points[i].x} ${points[i].y}`;
                    }
                    activePath.setAttribute("d", d);
                    
                    // Update guide line start position
                    if (guideLine) {
                        const lastPoint = points[points.length - 1];
                        guideLine.setAttribute("x1", lastPoint.x);
                        guideLine.setAttribute("y1", lastPoint.y);
                        
                        // We also need to trigger a mouse move update to fix x2, y2 based on current mouse pos
                        // But we don't have event here.
                        // However, if the user moves mouse slightly, it will correct.
                        // Or we can just leave x2,y2 as is (it points to cursor).
                        // Since cursor didn't move, x2,y2 should remain at cursor.
                        // But x1,y1 changed to previous point.
                    }
                }
                
                // Stop global undo
                evt.stopPropagation();
                evt.preventDefault();
            }
        }
    }

    svg.addEventListener("mousedown", onMouseDown);
    svg.addEventListener("mousemove", onMouseMove);
    svg.addEventListener("dblclick", onDblClick);
    svg.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("keydown", onKeyDown, true); // Capture phase to intercept global undo

    return () => {
        isToolActive = false;
        svg.removeEventListener("mousedown", onMouseDown);
        svg.removeEventListener("mousemove", onMouseMove);
        svg.removeEventListener("dblclick", onDblClick);
        svg.removeEventListener("contextmenu", onContextMenu);
        window.removeEventListener("keydown", onKeyDown, true);
        
        // Cleanup active drawing if tool switched
        if (activePath) {
            resetState();
        }
        console.log("Deactivate polygon tool");
    };
}
