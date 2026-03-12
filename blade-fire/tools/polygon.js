import { setCursor, getOverlayLayer } from "../common/index.js";

const SVG_NS = "http://www.w3.org/2000/svg";

export function polygon(svg) {
    console.log("Polygon tool activated");
    if (svg) {
        setCursor(svg, "crosshair");
    }

    // State
    let points = [];
    let activePath = null;
    let toolGroup = null;
    let guideLine = null;
    let startPointMarker = null; // Visual indicator for the start point
    let snapIndicator = null; // Visual for snap point
    let viewChangeObserver = null;
    let lastMouseMoveEvent = null;

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
        guideLine = null;
        startPointMarker = null;
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

            // Create tool group
            toolGroup = createSVGElement("g", {
                "pointer-events": "none"
            });
            svg.appendChild(toolGroup);

            // Create guide line (SVG Line)
            guideLine = createSVGElement("line", {
                stroke: "red",
                "stroke-dasharray": "5,5",
                "pointer-events": "none"
            });
            toolGroup.appendChild(guideLine);

            // Create start point marker (SVG Circle)
            startPointMarker = createSVGElement("circle", {
                fill: "white",
                stroke: "red",
                cursor: "pointer",
                "pointer-events": "auto" // Enable click
            });
            updateMarkerAttr(startPointMarker, pos);
            toolGroup.appendChild(startPointMarker);

            // Add viewBox observer
            handleViewBoxChange(); // Initial call
            viewChangeObserver = new MutationObserver(handleViewBoxChange);
            viewChangeObserver.observe(svg, { attributes: true, attributeFilter: ['viewBox'] });
        }

        updatePath();
    }

    // Helper to map SVG coord to SVG attributes (handling scale)
    function updateMarkerAttr(el, svgPos) {
        const CTM = svg.getScreenCTM();
        const scale = 1 / CTM.a;
        el.setAttribute("cx", svgPos.x);
        el.setAttribute("cy", svgPos.y);
        el.setAttribute("r", 5 * scale);
        el.setAttribute("stroke-width", 2 * scale);
    }

    function handleViewBoxChange() {
        if (lastMouseMoveEvent) {
            handleMouseMove(lastMouseMoveEvent);
        } else if (points.length > 0) {
             // Force update if we have points but no mouse move yet (e.g. initial zoom)
             if (startPointMarker) updateMarkerAttr(startPointMarker, points[0]);
        }
    }

    function updateGuideLineAttr(el, p1, p2) {
        const CTM = svg.getScreenCTM();
        const scale = 1 / CTM.a;
        el.setAttribute("x1", p1.x);
        el.setAttribute("y1", p1.y);
        el.setAttribute("x2", p2.x);
        el.setAttribute("y2", p2.y);
        el.setAttribute("stroke-width", 1 * scale);
    }

    function handleMouseMove(evt) {
        lastMouseMoveEvent = evt; // Store last event
        if (!points.length) return;

        if (snapIndicator) {
            snapIndicator.remove();
            snapIndicator = null;
        }

        let pos = getMousePos(evt);
        const snapPoint = findSnapPoint(pos);

        if (snapPoint) {
            pos = snapPoint;
            snapIndicator = createSVGElement("circle", {
                fill: "none",
                stroke: "blue",
                "pointer-events": "none"
            });
            if (toolGroup) toolGroup.appendChild(snapIndicator);
            updateMarkerAttr(snapIndicator, pos);
        }

        // Update guide line and start marker
        if (guideLine) {
            const lastPoint = points[points.length - 1];
            updateGuideLineAttr(guideLine, lastPoint, pos);
        }
        if (startPointMarker) {
            updateMarkerAttr(startPointMarker, points[0]);
        }
    }

    function onMouseMove(evt) {
        handleMouseMove(evt);
    }

    function onContextMenu(evt) {
        evt.preventDefault();
        if (points.length >= 3) {
            closePolygon();
        } else if (points.length > 0) {
            resetState();
        }
    }

    // Attach listeners
    svg.addEventListener("mousedown", onMouseDown);
    svg.addEventListener("mousemove", onMouseMove);
    svg.addEventListener("contextmenu", onContextMenu);

    // Cleanup function
    return () => {
        console.log("Polygon tool deactivated");
        svg.removeEventListener("mousedown", onMouseDown);
        svg.removeEventListener("mousemove", onMouseMove);
        svg.removeEventListener("contextmenu", onContextMenu);
        resetState();
    };
}
