import { history, createShape, createListenerManager } from "../common/index.js";
import polygonClipping from 'polygon-clipping';

const ERASER_RADIUS = 10;
let isDrawing = false;
let eraserPath = null;
let svgElement = null;
let points = [];
let pathData = "";
const listeners = createListenerManager();

function getMousePosition(evt) {
    if (!svgElement) return { x: 0, y: 0 };
    const CTM = svgElement.getScreenCTM();
    if (!CTM) return { x: 0, y: 0 };
    return {
        x: (evt.clientX - CTM.e) / CTM.a,
        y: (evt.clientY - CTM.f) / CTM.d
    };
}

// 橡皮擦样式的 SVG cursor
const eraserSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20H7L3 16C2.5 15.5 2.5 14.5 3 14L13 4C13.5 3.5 14.5 3.5 15 4L20 9C20.5 9.5 20.5 10.5 20 11L11 20H20V20Z"/></svg>`;
const cursorUrl = `url('data:image/svg+xml;utf8,${encodeURIComponent(eraserSvg)}') 0 24, auto`;

function setCursor(svg, cursor) {
    if (svg) {
        svg.style.cursor = cursor;
    }
}

function onMouseDown(evt) {
    if (evt.button !== 0) return; // 仅响应左键

    isDrawing = true;
    const pos = getMousePosition(evt);
    points = [pos];
    
    pathData = `M ${pos.x} ${pos.y}`;
    
    // 创建一个临时路径来显示橡皮擦的轨迹
    eraserPath = createShape("path", {
        d: pathData,
        fill: "none",
        stroke: "rgba(255, 255, 255, 0.8)",
        "stroke-width": ERASER_RADIUS * 1,
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        "pointer-events": "none",
        "data-is-eraser": "true"
    });
    
    svgElement.appendChild(eraserPath);
}

function onMouseMove(evt) {
    if (!isDrawing || !eraserPath) return;

    const pos = getMousePosition(evt);
    
    // 只有当鼠标移动距离超过一定阈值时才添加点，减少计算量
    const lastPos = points[points.length - 1];
    const dx = pos.x - lastPos.x;
    const dy = pos.y - lastPos.y;
    if (Math.sqrt(dx*dx + dy*dy) < ERASER_RADIUS / 2) {
        return;
    }

    points.push(pos);
    
    pathData += ` L ${pos.x} ${pos.y}`;
    eraserPath.setAttribute("d", pathData);
}

function onMouseUp(evt) {
    if (isDrawing) {
        isDrawing = false;
        
        if (eraserPath) {
            eraserPath.remove();
            eraserPath = null;
        }

        if (points.length > 1) {
            applyEraser(points);
        }
        
        points = [];
        pathData = "";
    }
}

function parsePathToMultiPolygon(d) {
    const commands = d.match(/[MmLlHhVvZz][^MmLlHhVvZz]*/g) || [];
    let multiPolygon = [];
    let currentPolygon = [];
    let currentRing = [];
    let currentPos = [0, 0];
    let startPos = [0, 0];
    
    commands.forEach(cmdStr => {
        const type = cmdStr[0];
        const args = cmdStr.slice(1).trim().split(/[\s,]+/).map(parseFloat).filter(n => !isNaN(n));
        
        if (type === 'M' || type === 'm') {
            if (currentRing.length > 0) {
                currentPolygon.push(currentRing);
                multiPolygon.push(currentPolygon);
                currentPolygon = [];
            }
            currentRing = [];
            for (let i = 0; i < args.length; i += 2) {
                if (type === 'm') {
                    currentPos[0] += args[i];
                    currentPos[1] += args[i+1];
                } else {
                    currentPos = [args[i], args[i+1]];
                }
                currentRing.push([...currentPos]);
                if (i === 0) startPos = [...currentPos];
            }
        } else if (type === 'L' || type === 'l') {
            for (let i = 0; i < args.length; i += 2) {
                if (type === 'l') {
                    currentPos[0] += args[i];
                    currentPos[1] += args[i+1];
                } else {
                    currentPos = [args[i], args[i+1]];
                }
                currentRing.push([...currentPos]);
            }
        } else if (type === 'H' || type === 'h') {
             for (let i = 0; i < args.length; i++) {
                if (type === 'h') currentPos[0] += args[i];
                else currentPos[0] = args[i];
                currentRing.push([...currentPos]);
             }
        } else if (type === 'V' || type === 'v') {
             for (let i = 0; i < args.length; i++) {
                if (type === 'v') currentPos[1] += args[i];
                else currentPos[1] = args[i];
                currentRing.push([...currentPos]);
             }
        } else if (type === 'Z' || type === 'z') {
            if (currentRing.length > 0) {
                // Ensure the ring is closed
                const firstPoint = currentRing[0];
                const lastPoint = currentRing[currentRing.length - 1];
                if (firstPoint[0] !== lastPoint[0] || firstPoint[1] !== lastPoint[1]) {
                    currentRing.push([...firstPoint]);
                }
                currentPolygon.push(currentRing);
                multiPolygon.push(currentPolygon);
                currentPolygon = [];
                currentRing = [];
            }
        }
    });
    if (currentRing.length > 0) {
        currentPolygon.push(currentRing);
        multiPolygon.push(currentPolygon);
    }
    return multiPolygon;
}

function multiPolygonToPathList(multiPolygon) {
    let paths = [];
    for (const poly of multiPolygon) {
        let d = "";
        for (const ring of poly) {
            if (ring.length === 0) continue;
            d += `M ${ring[0][0]} ${ring[0][1]} `;
            for (let i = 1; i < ring.length; i++) {
                d += `L ${ring[i][0]} ${ring[i][1]} `;
            }
            d += "Z ";
        }
        if (d) paths.push(d.trim());
    }
    return paths;
}

function getEraserMultiPolygon(points, radius) {
    let polys = [];
    const segments = 16;
    
    // Helper to create circle polygon
    function createCirclePoly(p) {
        let ring = [];
        for (let i = 0; i < segments; i++) {
            let angle = (i / segments) * Math.PI * 2;
            ring.push([p.x + Math.cos(angle) * radius, p.y + Math.sin(angle) * radius]);
        }
        ring.push([...ring[0]]);
        return [ring];
    }

    // For each segment, add a rotated rectangle
    for (let i = 0; i < points.length - 1; i++) {
        let p1 = points[i];
        let p2 = points[i+1];
        let dx = p2.x - p1.x;
        let dy = p2.y - p1.y;
        let len = Math.sqrt(dx*dx + dy*dy);
        if (len === 0) continue;
        let nx = -dy / len * radius;
        let ny = dx / len * radius;
        
        let poly = [[
            [p1.x + nx, p1.y + ny],
            [p1.x - nx, p1.y - ny],
            [p2.x - nx, p2.y - ny],
            [p2.x + nx, p2.y + ny],
            [p1.x + nx, p1.y + ny]
        ]];
        polys.push(poly);
    }
    // For each point, generate a circular polygon to make the path smooth
    for (let i = 0; i < points.length; i++) {
        polys.push(createCirclePoly(points[i]));
    }
    
    if (polys.length === 0) return null;
    try {
        return polygonClipping.union(...polys);
    } catch (e) {
        console.error("Eraser union error", e);
        return null;
    }
}

function applyEraser(points) {
    const eraserPoly = getEraserMultiPolygon(points, ERASER_RADIUS);
    if (!eraserPoly) return;

    const paths = Array.from(svgElement.querySelectorAll('path'));
    const modifications = [];
    const newElements = [];

    paths.forEach(pathEl => {
        if (pathEl.getAttribute("data-is-grid") || pathEl.getAttribute("data-is-eraser")) return;
        
        const d = pathEl.getAttribute("d");
        if (!d || !d.match(/Z|z/)) return; // 仅处理闭合的图形

        try {
            const targetPoly = parsePathToMultiPolygon(d);
            if (targetPoly.length === 0) return;

            const diff = polygonClipping.difference(targetPoly, eraserPoly);
            const pathDataList = multiPolygonToPathList(diff);
            
            // 如果擦除后没有任何路径了
            if (pathDataList.length === 0) {
                modifications.push({
                    element: pathEl,
                    oldD: d,
                    action: 'remove'
                });
            } else {
                // 如果擦除后变成了多个独立的闭合多边形
                // 我们保留原有的 path 元素作为第一个多边形，并为其他多边形创建新的 path 元素
                const firstD = pathDataList[0];
                if (d !== firstD || pathDataList.length > 1) {
                    const mod = {
                        element: pathEl,
                        oldD: d,
                        newD: firstD,
                        action: 'modify',
                        addedElements: []
                    };

                    // 处理分离出来的其他多边形块
                    for (let i = 1; i < pathDataList.length; i++) {
                        const newPath = pathEl.cloneNode(true);
                        newPath.setAttribute("d", pathDataList[i]);
                        // 需要生成一个新的 uid
                        const oldUid = newPath.getAttribute("uid");
                        if (oldUid) {
                            newPath.setAttribute("uid", oldUid + "-part" + i);
                        }
                        mod.addedElements.push(newPath);
                        newElements.push(newPath);
                    }
                    modifications.push(mod);
                }
            }
        } catch (e) {
            console.error("Clipping error on path", pathEl, e);
        }
    });

    if (modifications.length > 0) {
        modifications.forEach(mod => {
            if (mod.action === 'remove') {
                mod.element.style.display = "none";
            } else if (mod.action === 'modify') {
                mod.element.setAttribute("d", mod.newD);
                mod.addedElements.forEach(el => svgElement.appendChild(el));
            }
        });

        history.push({
            desc: '橡皮擦擦除多边形',
            undo: () => {
                modifications.forEach(mod => {
                    mod.element.setAttribute("d", mod.oldD);
                    mod.element.style.display = "";
                    if (mod.addedElements) {
                        mod.addedElements.forEach(el => el.remove());
                    }
                });
            },
            redo: () => {
                modifications.forEach(mod => {
                    if (mod.action === 'remove') {
                        mod.element.style.display = "none";
                    } else if (mod.action === 'modify') {
                        mod.element.setAttribute("d", mod.newD);
                        mod.addedElements.forEach(el => svgElement.appendChild(el));
                    }
                });
            }
        });
    }
}

export function erase(svg) {
    svgElement = svg;
    if (!svgElement) {
        console.error("BladeFire SVG not initialized");
        return;
    }

    setCursor(svgElement, cursorUrl);

    listeners.activate();
    listeners.on(svgElement, "mousedown", onMouseDown);
    listeners.on(window, "mousemove", onMouseMove);
    listeners.on(window, "mouseup", onMouseUp);

    return () => {
        listeners.dispose();
        setCursor(svgElement, "default"); // 恢复默认鼠标指针
        if (eraserPath) {
            eraserPath.remove();
            eraserPath = null;
        }
    };
}
