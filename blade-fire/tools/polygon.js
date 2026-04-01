import { setCursor, getOverlayLayer, history, createShape, getToolStyle } from "../common/index.js";

const SVG_NS = "http://www.w3.org/2000/svg";

export function polygon(svg) {
    console.log("Polygon tool activated");
    if (svg) {
        setCursor(svg, "crosshair");
    }

    
    let isToolActive = true;
    let points = [];
    let activePath = null;
    let toolGroup = null;
    let guideLine = null;
    let startPointMarker = null; 
    let snapIndicator = null; 
    let viewChangeObserver = null;
    let lastMouseMoveEvent = null;

    
    function findSnapPoint(mousePos, snapRadius = 10) {
        const allPaths = Array.from(svg.querySelectorAll('path'));
        let closestPoint = null;
        let minDistance = Infinity;

        const CTM = svg.getScreenCTM();
        const mouseScreenX = mousePos.x * CTM.a + CTM.e;
        const mouseScreenY = mousePos.y * CTM.d + CTM.f;

        for (const path of allPaths) {
            if (path === activePath) continue; 
            const d = path.getAttribute('d');
            if (!d) continue;

            
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

            const matrix = path.getCTM();
            if (!matrix) continue;

            for (const p of points) {
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
            y: (evt.clientY - CTM.f) / CTM.d
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
        
        const savedPoints = [...points];
        const path = activePath;
        
        history.push({
            desc: '创建多边形',
            undo: () => {
                if (path && path.parentNode) {
                    path.remove();
                }
            },
            redo: () => {
                let d = path.getAttribute("d");
                if (!d.match(/Z\s*$/i)) d += " Z";
                path.setAttribute("d", d);
                path.setAttribute("fill", "transparent");
                svg.appendChild(path);
            }
        });

        resetState(false); 
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
        lastMouseMoveEvent = null;
    }

    function onMouseDown(evt) {
        
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

        
        const externalSnapPoint = findSnapPoint(pos);
        if (externalSnapPoint) {
            pos = externalSnapPoint;
        }

        points.push(pos);

        if (points.length === 1) {
            
            activePath = createShape("path", {
                "stroke-linejoin": "round",
                "stroke-linecap": "round",
                ...getToolStyle("polygon")
            });
            svg.appendChild(activePath);
            
            
            toolGroup = createShape("g", { "pointer-events": "none" });
            svg.appendChild(toolGroup);

            
            startPointMarker = createShape("circle", {
                "cx": pos.x,
                "cy": pos.y,
                "r": 5,
                "fill": "rgba(0, 255, 0, 0.5)",
                "stroke": "green",
                "pointer-events": "all",
                "cursor": "pointer"
            });
            svg.appendChild(startPointMarker); 

            
            guideLine = createShape("line", {
                "x1": pos.x,
                "y1": pos.y,
                "x2": pos.x,
                "y2": pos.y,
                "stroke": "green",
                "stroke-width": "1",
                "stroke-dasharray": "5,5"
            });
            toolGroup.appendChild(guideLine);

            
            viewChangeObserver = new MutationObserver(() => {
                if (snapIndicator) {
                    snapIndicator.setAttribute("r", 5 / (svg.getScreenCTM().a || 1));
                    snapIndicator.setAttribute("stroke-width", 2 / (svg.getScreenCTM().a || 1));
                }
            });
            viewChangeObserver.observe(svg, { attributes: true, attributeFilter: ['viewBox', 'width', 'height'] });

        } else {
            updatePath();
            
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

        
        guideLine.setAttribute("x2", pos.x);
        guideLine.setAttribute("y2", pos.y);
    }

    function onDblClick(evt) {
        
        closePolygon();
    }

    function onContextMenu(evt) {
        evt.preventDefault();
        evt.stopPropagation();
        return false;
    }

    function onKeyDown(evt) {
        
        if ((evt.ctrlKey || evt.metaKey) && evt.key.toLowerCase() === 'z' && !evt.shiftKey) {
            if (activePath && points.length > 0) {
                
                points.pop();
                
                if (points.length < 2) {
                    
                    resetState();
                } else {
                    
                    let d = `M ${points[0].x} ${points[0].y}`;
                    for (let i = 1; i < points.length; i++) {
                        d += ` L ${points[i].x} ${points[i].y}`;
                    }
                    activePath.setAttribute("d", d);
                    
                    
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
    window.addEventListener("keydown", onKeyDown, true); 

    return () => {
        isToolActive = false;
        svg.removeEventListener("mousedown", onMouseDown);
        svg.removeEventListener("mousemove", onMouseMove);
        svg.removeEventListener("dblclick", onDblClick);
        svg.removeEventListener("contextmenu", onContextMenu);
        window.removeEventListener("keydown", onKeyDown, true);
        
        
        if (activePath) {
            resetState();
        }
        console.log("Deactivate polygon tool");
    };
}
