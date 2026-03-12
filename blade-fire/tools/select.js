import { setCursor } from "../common/index.js";

const SVG_NS = "http://www.w3.org/2000/svg";

export function select(svg) {
    console.log("Select tool activated");
    setCursor(svg, "default");

    // State
    let selectedElements = []; // Array of selected elements
    let transformGroup = null; // The visual handles group
    let selectionRect = null; // The rubber band rect
    
    // Drag State
    let isDragging = false;
    let dragMode = null; // 'select', 'move', 'resize', 'rotate'
    let startPos = { x: 0, y: 0 }; // Mouse down position
    let initialMouse = { x: 0, y: 0 }; // Mouse position at start of drag
    
    // Captured state for transformation
    let elementStates = []; // Store initial state of elements
    let groupBounds = null; // {x, y, w, h, cx, cy} for multi-selection group
    let resizeHandle = null; // 'nw', 'ne', etc.
    
    // Helper: Parse transform string to object
    function parseTransform(transformStr) {
        const result = { tx: 0, ty: 0, rotate: 0, cx: 0, cy: 0 };
        if (!transformStr) return result;
        
        // Match translate
        const tMatch = transformStr.match(/translate\s*\(\s*([-\d.e]+)\s*[,\s]\s*([-\d.e]+)\s*\)/);
        if (tMatch) {
            result.tx = parseFloat(tMatch[1]);
            result.ty = parseFloat(tMatch[2]);
        }
        
        // Match rotate
        const rMatch = transformStr.match(/rotate\s*\(\s*([-\d.e]+)(?:\s*[,\s]\s*([-\d.e]+)\s*[,\s]\s*([-\d.e]+))?\s*\)/);
        if (rMatch) {
            result.rotate = parseFloat(rMatch[1]);
            if (rMatch[2] !== undefined) result.cx = parseFloat(rMatch[2]);
            if (rMatch[3] !== undefined) result.cy = parseFloat(rMatch[3]);
        }
        
        return result;
    }

    // Helper: Rotate a point around a center
    function rotatePoint(x, y, cx, cy, angle) {
        const rad = angle * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const dx = x - cx;
        const dy = y - cy;
        return {
            x: cx + dx * cos - dy * sin,
            y: cy + dx * sin + dy * cos
        };
    }

    // Helper: Get mouse position in SVG coordinates
    function getMousePosition(evt) {
        const CTM = svg.getScreenCTM();
        if (!CTM) return { x: 0, y: 0 };
        return {
            x: (evt.clientX - CTM.e) / CTM.a,
            y: (evt.clientY - CTM.f) / CTM.d
        };
    }

    // Helper: Create the selection box (rubber band)
    function createSelectionRect(x, y) {
        const rect = document.createElementNS(SVG_NS, "rect");
        rect.setAttribute("x", x);
        rect.setAttribute("y", y);
        rect.setAttribute("width", 0);
        rect.setAttribute("height", 0);
        rect.setAttribute("fill", "rgba(24, 144, 255, 0.1)");
        rect.setAttribute("stroke", "#1890ff");
        rect.setAttribute("stroke-width", 1);
        rect.setAttribute("stroke-dasharray", "4 2");
        svg.appendChild(rect);
        return rect;
    }

    // Helper: Get global bounding box of an element (transform applied)
    function getElementGlobalBounds(el) {
        try {
            const bbox = el.getBBox();
            const ctm = el.getCTM();
            // Transform 4 corners
            const pts = [
                { x: bbox.x, y: bbox.y },
                { x: bbox.x + bbox.width, y: bbox.y },
                { x: bbox.x + bbox.width, y: bbox.y + bbox.height },
                { x: bbox.x, y: bbox.y + bbox.height }
            ];
            
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            pts.forEach(p => {
                const x = ctm.a * p.x + ctm.c * p.y + ctm.e;
                const y = ctm.b * p.x + ctm.d * p.y + ctm.f;
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
            });
            
            return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
        } catch (e) {
            return { x: 0, y: 0, width: 0, height: 0 };
        }
    }

    // Create/Update transform handles
    function updateTransformHandles() {
        if (transformGroup) {
            if (transformGroup.parentNode) transformGroup.parentNode.removeChild(transformGroup);
            transformGroup = null;
        }

        if (selectedElements.length === 0) return;

        transformGroup = document.createElementNS(SVG_NS, "g");
        
        let bbox;
        
        if (selectedElements.length === 1) {
            // Single selection: Use local BBox and apply element's transform to handles
            const el = selectedElements[0];
            try {
                bbox = el.getBBox();
                const transform = el.getAttribute("transform");
                if (transform) {
                    transformGroup.setAttribute("transform", transform);
                }
            } catch (e) {
                bbox = { x: 0, y: 0, width: 0, height: 0 };
            }
        } else {
            // Multi selection: Use Global Union AABB
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            selectedElements.forEach(el => {
                const b = getElementGlobalBounds(el);
                minX = Math.min(minX, b.x);
                minY = Math.min(minY, b.y);
                maxX = Math.max(maxX, b.x + b.width);
                maxY = Math.max(maxY, b.y + b.height);
            });
            bbox = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
        }

        // Frame
        const frame = document.createElementNS(SVG_NS, "rect");
        frame.setAttribute("x", bbox.x);
        frame.setAttribute("y", bbox.y);
        frame.setAttribute("width", bbox.width);
        frame.setAttribute("height", bbox.height);
        frame.setAttribute("fill", "none");
        frame.setAttribute("stroke", "#1890ff");
        frame.setAttribute("stroke-width", 1);
        frame.setAttribute("class", "selection-frame");
        transformGroup.appendChild(frame);

        // Resize Handles
        const handleSize = 8;
        const positions = [
            { x: bbox.x, y: bbox.y, cursor: "nw-resize", type: "nw" },
            { x: bbox.x + bbox.width, y: bbox.y, cursor: "ne-resize", type: "ne" },
            { x: bbox.x + bbox.width, y: bbox.y + bbox.height, cursor: "se-resize", type: "se" },
            { x: bbox.x, y: bbox.y + bbox.height, cursor: "sw-resize", type: "sw" },
            // Middle handles
            { x: bbox.x + bbox.width / 2, y: bbox.y, cursor: "n-resize", type: "n" },
            { x: bbox.x + bbox.width, y: bbox.y + bbox.height / 2, cursor: "e-resize", type: "e" },
            { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height, cursor: "s-resize", type: "s" },
            { x: bbox.x, y: bbox.y + bbox.height / 2, cursor: "w-resize", type: "w" }
        ];

        positions.forEach(pos => {
            const handle = document.createElementNS(SVG_NS, "rect");
            handle.setAttribute("x", pos.x - handleSize / 2);
            handle.setAttribute("y", pos.y - handleSize / 2);
            handle.setAttribute("width", handleSize);
            handle.setAttribute("height", handleSize);
            handle.setAttribute("fill", "white");
            handle.setAttribute("stroke", "#1890ff");
            handle.setAttribute("stroke-width", 1);
            handle.style.cursor = pos.cursor;
            handle.dataset.type = pos.type;
            transformGroup.appendChild(handle);
        });

        // Rotate Handle
        const rotHandle = document.createElementNS(SVG_NS, "circle");
        const rotX = bbox.x + bbox.width / 2;
        const rotY = bbox.y - 20;
        rotHandle.setAttribute("cx", rotX);
        rotHandle.setAttribute("cy", rotY);
        rotHandle.setAttribute("r", 5);
        rotHandle.setAttribute("fill", "white");
        rotHandle.setAttribute("stroke", "#1890ff");
        rotHandle.style.cursor = "grab";
        rotHandle.dataset.type = "rotate";
        transformGroup.appendChild(rotHandle);

        // Line connecting rotation handle
        const line = document.createElementNS(SVG_NS, "line");
        line.setAttribute("x1", rotX);
        line.setAttribute("y1", rotY + 5);
        line.setAttribute("x2", rotX);
        line.setAttribute("y2", bbox.y);
        line.setAttribute("stroke", "#1890ff");
        transformGroup.insertBefore(line, rotHandle);

        svg.appendChild(transformGroup);
    }

    function clearSelection() {
        selectedElements = [];
        updateTransformHandles();
    }

    function captureState(pos) {
        initialMouse = pos;
        
        if (selectedElements.length === 1) {
            const el = selectedElements[0];
            const transform = el.getAttribute("transform") || "";
            const tData = parseTransform(transform);
            
            elementStates = [{
                el,
                initTx: tData.tx,
                initTy: tData.ty,
                initRot: tData.rotate,
                initCx: tData.cx,
                initCy: tData.cy,
                bbox: el.getBBox(),
                initWidth: parseFloat(el.getAttribute("width")),
                initHeight: parseFloat(el.getAttribute("height")),
                initX: parseFloat(el.getAttribute("x")),
                initY: parseFloat(el.getAttribute("y")),
                initTransform: transform
            }];
        } else {
            // Multi-selection state
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            elementStates = selectedElements.map(el => {
                const b = getElementGlobalBounds(el);
                minX = Math.min(minX, b.x);
                minY = Math.min(minY, b.y);
                maxX = Math.max(maxX, b.x + b.width);
                maxY = Math.max(maxY, b.y + b.height);
                return {
                    el,
                    initTransform: el.getAttribute("transform") || ""
                };
            });
            
            groupBounds = {
                x: minX,
                y: minY,
                width: maxX - minX,
                height: maxY - minY,
                cx: minX + (maxX - minX) / 2,
                cy: minY + (maxY - minY) / 2
            };
        }
    }

    function onMouseDown(evt) {
        if (evt.button !== 0) return;
        const pos = getMousePosition(evt);
        startPos = pos;
        isDragging = true;
        const target = evt.target;

        // 1. Check Handle Click
        if (target.parentNode === transformGroup && target.dataset.type) {
            dragMode = target.dataset.type === 'rotate' ? 'rotate' : 'resize';
            resizeHandle = target.dataset.type;
            setCursor(svg, target.style.cursor);
            captureState(pos);
            evt.stopPropagation();
            return;
        }

        // 2. Check Element Click (Selected or Frame)
        const isSelected = selectedElements.includes(target);
        const isFrame = target.parentNode === transformGroup && target.classList.contains('selection-frame');

        if (isSelected || isFrame) {
            if ((evt.shiftKey || evt.ctrlKey) && isSelected) {
                // Deselect logic
                selectedElements = selectedElements.filter(el => el !== target);
                updateTransformHandles();
                isDragging = false;
                return;
            }
            
            dragMode = 'move';
            setCursor(svg, "move");
            captureState(pos);
            return;
        }

        // 3. Check Unselected Element Click
        if (target !== svg && target.getAttribute('data-is-grid') !== 'true' && !target.classList.contains('grid-rect') && target.parentNode === svg) {
            if (evt.shiftKey || evt.ctrlKey) {
                selectedElements.push(target);
            } else {
                selectedElements = [target];
            }
            updateTransformHandles();
            
            dragMode = 'move';
            setCursor(svg, "move");
            captureState(pos);
            return;
        }

        // 4. Background Click -> Box Select
        if (!evt.shiftKey && !evt.ctrlKey) {
            clearSelection();
        }
        dragMode = 'select';
        selectionRect = createSelectionRect(pos.x, pos.y);
    }

    function onMouseMove(evt) {
        if (!isDragging) return;
        const pos = getMousePosition(evt);
        const dx = pos.x - initialMouse.x;
        const dy = pos.y - initialMouse.y;

        if (dragMode === 'select') {
            const x = Math.min(startPos.x, pos.x);
            const y = Math.min(startPos.y, pos.y);
            const w = Math.abs(pos.x - startPos.x);
            const h = Math.abs(pos.y - startPos.y);
            selectionRect.setAttribute("x", x);
            selectionRect.setAttribute("y", y);
            selectionRect.setAttribute("width", w);
            selectionRect.setAttribute("height", h);
        }
        else if (dragMode === 'move') {
            if (selectedElements.length === 1) {
                const s = elementStates[0];
                const newTx = s.initTx + dx;
                const newTy = s.initTy + dy;
                // Keep original rotation center if it was set, or default to center
                let cx = s.initCx;
                let cy = s.initCy;
                if (!s.initRot) {
                    cx = s.bbox.x + s.bbox.width/2;
                    cy = s.bbox.y + s.bbox.height/2;
                }
                
                let tStr = `translate(${newTx}, ${newTy})`;
                if (s.initRot) {
                    tStr += ` rotate(${s.initRot}, ${cx}, ${cy})`;
                }
                s.el.setAttribute("transform", tStr);
                transformGroup.setAttribute("transform", tStr);
            } else {
                // Multi-move
                selectedElements.forEach((el, i) => {
                    const s = elementStates[i];
                    el.setAttribute("transform", `translate(${dx}, ${dy}) ${s.initTransform}`);
                });
                transformGroup.setAttribute("transform", `translate(${dx}, ${dy})`);
            }
        }
        else if (dragMode === 'rotate') {
            if (selectedElements.length === 1) {
                const s = elementStates[0];
                // Local rotation center
                const cx = s.bbox.x + s.bbox.width/2;
                const cy = s.bbox.y + s.bbox.height/2;
                
                // Calculate angle relative to center
                // Center in screen space is (cx + tx, cy + ty)
                const centerX = cx + s.initTx;
                const centerY = cy + s.initTy;
                
                const angle = Math.atan2(pos.y - centerY, pos.x - centerX) * 180 / Math.PI + 90;
                
                // Update transform
                const tStr = `translate(${s.initTx}, ${s.initTy}) rotate(${angle}, ${cx}, ${cy})`;
                s.el.setAttribute("transform", tStr);
                transformGroup.setAttribute("transform", tStr);
            } else {
                // Multi-rotate
                const cx = groupBounds.cx;
                const cy = groupBounds.cy;
                const angle = Math.atan2(pos.y - cy, pos.x - cx) * 180 / Math.PI + 90;
                
                selectedElements.forEach((el, i) => {
                    const s = elementStates[i];
                    el.setAttribute("transform", `rotate(${angle}, ${cx}, ${cy}) ${s.initTransform}`);
                });
                transformGroup.setAttribute("transform", `rotate(${angle}, ${cx}, ${cy})`);
            }
        }
        else if (dragMode === 'resize') {
            if (selectedElements.length === 1) {
                const s = elementStates[0];
                
                // 1. Calculate local delta
                let ldx = dx;
                let ldy = dy;
                if (s.initRot) {
                    const rad = s.initRot * Math.PI / 180;
                    const cos = Math.cos(-rad);
                    const sin = Math.sin(-rad);
                    ldx = dx * cos - dy * sin;
                    ldy = dx * sin + dy * cos;
                }
                
                if (s.el.tagName === 'rect') {
                    // 2. Identify anchor point (opposite corner) in local space
                    let anchorX = s.initX;
                    let anchorY = s.initY;
                    // If resizing 'nw', anchor is 'se' (x+w, y+h)
                    // If resizing 'ne', anchor is 'sw' (x, y+h)
                    // etc.
                    
                    if (resizeHandle.includes('w')) anchorX = s.initX + s.initWidth;
                    if (resizeHandle.includes('n')) anchorY = s.initY + s.initHeight;
                    // If resizing 'se', anchor is 'nw' (x, y). Default.
                    
                    // 3. Calculate Global Anchor Position (using initial transform)
                    // P_global = T(initTx, initTy) * R(initRot, initCx, initCy) * P_local_anchor
                    const globalAnchor = rotatePoint(anchorX, anchorY, s.initCx || (s.bbox.x + s.bbox.width/2), s.initCy || (s.bbox.y + s.bbox.height/2), s.initRot);
                    globalAnchor.x += s.initTx;
                    globalAnchor.y += s.initTy;
                    
                    // 4. Update local dimensions
                    let newW = s.initWidth;
                    let newH = s.initHeight;
                    let newX = s.initX;
                    let newY = s.initY;
                    
                    if (resizeHandle.includes('e')) newW += ldx;
                    if (resizeHandle.includes('s')) newH += ldy;
                    if (resizeHandle.includes('w')) { newW -= ldx; newX += ldx; }
                    if (resizeHandle.includes('n')) { newH -= ldy; newY += ldy; }
                    
                    if (newW < 1) newW = 1;
                    if (newH < 1) newH = 1;
                    
                    // 5. Calculate new local center
                    const newCX = newX + newW / 2;
                    const newCY = newY + newH / 2;
                    
                    // 6. Calculate where the anchor would be with the NEW center but OLD translate
                    // We need to find newTx, newTy such that:
                    // globalAnchor = T(newTx, newTy) * R(initRot, newCX, newCY) * P_local_anchor
                    // Note: P_local_anchor coordinates in the new rect are the SAME values as before 
                    // (e.g. if we resized Left, the Right edge is still at X+W = initX+initW)
                    
                    const rotatedAnchor = rotatePoint(anchorX, anchorY, newCX, newCY, s.initRot);
                    
                    const newTx = globalAnchor.x - rotatedAnchor.x;
                    const newTy = globalAnchor.y - rotatedAnchor.y;
                    
                    // 7. Apply updates
                    s.el.setAttribute('x', newX);
                    s.el.setAttribute('y', newY);
                    s.el.setAttribute('width', newW);
                    s.el.setAttribute('height', newH);
                    
                    const tStr = `translate(${newTx}, ${newTy}) rotate(${s.initRot}, ${newCX}, ${newCY})`;
                    s.el.setAttribute("transform", tStr);
                    transformGroup.setAttribute("transform", tStr);
                    
                    // Crucial for smooth interaction: update handles to match new geometry
                    updateTransformHandles();
                }
            } else {
                // Multi Element Resize
                // Calculate scale factors based on group bounds
                const currentW = groupBounds.width;
                const currentH = groupBounds.height;
                
                let newX = groupBounds.x;
                let newY = groupBounds.y;
                let newW = currentW;
                let newH = currentH;
                
                if (resizeHandle.includes('e')) newW += dx;
                if (resizeHandle.includes('s')) newH += dy;
                if (resizeHandle.includes('w')) { newW -= dx; newX += dx; }
                if (resizeHandle.includes('n')) { newH -= dy; newY += dy; }
                
                if (newW < 1) newW = 1;
                if (newH < 1) newH = 1;
                
                const sx = newW / currentW;
                const sy = newH / currentH;
                
                // Calculate translation to map old position to new position
                // newX = oldX * sx + tx -> tx = newX - oldX * sx
                const tx = newX - groupBounds.x * sx;
                const ty = newY - groupBounds.y * sy;
                
                // Apply transform: T(tx, ty) * S(sx, sy)
                selectedElements.forEach((el, i) => {
                    const s = elementStates[i];
                    // Prepend the new transform to the initial transform
                    el.setAttribute("transform", `translate(${tx}, ${ty}) scale(${sx}, ${sy}) ${s.initTransform}`);
                });
                
                // Update handles by redrawing at new bounds?
                // Or just transforming the group?
                // Transforming group is faster.
                transformGroup.setAttribute("transform", `translate(${tx}, ${ty}) scale(${sx}, ${sy})`);
            }
        }
    }

    function onMouseUp(evt) {
        if (!isDragging) return;
        isDragging = false;
        setCursor(svg, "default");

        if (dragMode === 'select') {
            const r1 = {
                x: parseFloat(selectionRect.getAttribute("x")),
                y: parseFloat(selectionRect.getAttribute("y")),
                w: parseFloat(selectionRect.getAttribute("width")),
                h: parseFloat(selectionRect.getAttribute("height"))
            };
            
            svg.removeChild(selectionRect);
            selectionRect = null;
            
            const children = Array.from(svg.children);
            for (let el of children) {
                if (el.tagName === 'defs' || el.tagName === 'g' || el.getAttribute('data-is-grid') === 'true' || el.classList.contains('grid-rect')) continue;
                
                try {
                    const bbox = getElementGlobalBounds(el);
                    // Simple AABB intersection
                    if (r1.x < bbox.x + bbox.width &&
                        r1.x + r1.w > bbox.x &&
                        r1.y < bbox.y + bbox.height &&
                        r1.y + r1.h > bbox.y) {
                        
                        if (!selectedElements.includes(el)) {
                            selectedElements.push(el);
                        }
                    }
                } catch(e) {}
            }
        }
        
        updateTransformHandles();
        dragMode = null;
    }

    // Attach listeners
    svg.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
        console.log("Select tool deactivated");
        svg.removeEventListener("mousedown", onMouseDown);
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
        clearSelection();
    };
}
