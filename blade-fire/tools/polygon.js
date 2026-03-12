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
    let guideLine = null;
    let startPointMarker = null; // Visual indicator for the start point
    let snapIndicator = null; // Visual for snap point
    let overlayContainer = null;

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
        if (guideLine) {
            guideLine.remove(); // HTML element
            guideLine = null;
        }
        if (startPointMarker) {
            startPointMarker.remove(); // HTML element
            startPointMarker = null;
        }
        if (snapIndicator) {
            snapIndicator.remove();
            snapIndicator = null;
        }
        points = [];
        activePath = null;
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

            // Get overlay container
            overlayContainer = getOverlayLayer(svg);

            // Create guide line (HTML Div)
            guideLine = document.createElement("div");
            guideLine.style.position = "absolute";
            guideLine.style.height = "1px"; // Thin line
            guideLine.style.backgroundColor = "red";
            guideLine.style.borderTop = "1px dashed red"; // Dashed style
            guideLine.style.backgroundColor = "transparent";
            guideLine.style.transformOrigin = "0 0";
            guideLine.style.pointerEvents = "none";
            overlayContainer.appendChild(guideLine);

            // Create start point marker (HTML Div)
            startPointMarker = document.createElement("div");
            startPointMarker.style.position = "absolute";
            startPointMarker.style.width = "10px";
            startPointMarker.style.height = "10px";
            startPointMarker.style.backgroundColor = "white";
            startPointMarker.style.border = "2px solid red";
            startPointMarker.style.borderRadius = "50%";
            startPointMarker.style.cursor = "pointer";
            startPointMarker.style.pointerEvents = "auto"; // Enable click
            startPointMarker.style.boxSizing = "border-box";
            
            updateMarkerPosition(startPointMarker, pos);
            
            overlayContainer.appendChild(startPointMarker);
        }

        updatePath();
    }

    // Helper to map SVG coord to HTML style
    function updateMarkerPosition(el, svgPos) {
        // We need to convert SVG local coordinate (svgPos) to pixel coordinate relative to the SVG element
        // Since foreignObject is 100% size of SVG, its coordinate system is the same as the SVG's client rect (0,0 at top-left)
        // We can use CTM to convert back.
        const CTM = svg.getScreenCTM();
        // screenX = svgX * a + e
        // screenY = svgY * d + f
        // But we need position relative to the SVG container (foreignObject), not screen.
        // So we subtract SVG's bounding client rect.
        const svgRect = svg.getBoundingClientRect();
        
        const screenX = svgPos.x * CTM.a + CTM.e;
        const screenY = svgPos.y * CTM.d + CTM.f;
        
        const localX = screenX - svgRect.left;
        const localY = screenY - svgRect.top;
        
        el.style.left = (localX - 5) + "px"; // -5 for centering (radius)
        el.style.top = (localY - 5) + "px";
    }

    function updateGuideLine(el, p1, p2) {
        const CTM = svg.getScreenCTM();
        const svgRect = svg.getBoundingClientRect();
        
        const sX1 = p1.x * CTM.a + CTM.e - svgRect.left;
        const sY1 = p1.y * CTM.d + CTM.f - svgRect.top;
        const sX2 = p2.x * CTM.a + CTM.e - svgRect.left;
        const sY2 = p2.y * CTM.d + CTM.f - svgRect.top;
        
        const dx = sX2 - sX1;
        const dy = sY2 - sY1;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;
        
        el.style.width = length + "px";
        el.style.left = sX1 + "px";
        el.style.top = sY1 + "px";
        el.style.transform = `rotate(${angle}deg)`;
    }

    function onMouseMove(evt) {
        if (!points.length) return;

        if (snapIndicator) snapIndicator.remove();

        let pos = getMousePos(evt);
        const snapPoint = findSnapPoint(pos);

        if (snapPoint) {
            pos = snapPoint;
            snapIndicator = document.createElement("div");
            snapIndicator.style.position = "absolute";
            snapIndicator.style.width = "12px";
            snapIndicator.style.height = "12px";
            snapIndicator.style.border = "2px solid blue";
            snapIndicator.style.borderRadius = "50%";
            snapIndicator.style.pointerEvents = "none";
            snapIndicator.style.boxSizing = "border-box";
            updateMarkerPosition(snapIndicator, pos);
            overlayContainer.appendChild(snapIndicator);
        }

        // Update guide line
        if (guideLine) {
            const lastPoint = points[points.length - 1];
            updateGuideLine(guideLine, lastPoint, pos);
        }
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
