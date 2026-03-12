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
        const result = { tx: 0, ty: 0, rotate: 0, cx: 0, cy: 0, sx: 1, sy: 1 };
        if (!transformStr) return result;
        
        // Match translate (first one)
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
        
        // Match scale
        const sMatch = transformStr.match(/scale\s*\(\s*([-\d.e]+)(?:\s*[,\s]\s*([-\d.e]+))?\s*\)/);
        if (sMatch) {
            result.sx = parseFloat(sMatch[1]);
            result.sy = sMatch[2] !== undefined ? parseFloat(sMatch[2]) : result.sx;
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

    function getElementGlobalBounds(el) {
        try {
            const rect = el.getBoundingClientRect();
            const svgRect = svg.getBoundingClientRect();
            const ctm = svg.getScreenCTM().inverse();

            const p1 = new DOMPoint(rect.left, rect.top);
            const p2 = new DOMPoint(rect.right, rect.bottom);

            const start = p1.matrixTransform(ctm);
            const end = p2.matrixTransform(ctm);

            return {
                x: start.x,
                y: start.y,
                width: end.x - start.x,
                height: end.y - start.y
            };
        } catch (e) {
            console.error("Failed to get element bounds:", e);
            return { x: 0, y: 0, width: 0, height: 0 };
        }
    }

    // Helper: Calculate visual cursor based on handle position and rotation
    function getCursorForHandle(handleType, rotation) {
        if (!handleType || handleType === 'rotate') return 'grab';
        
        // Map handle type to angle
        const angleMap = {
            'n': 0, 'ne': 45, 'e': 90, 'se': 135,
            's': 180, 'sw': 225, 'w': 270, 'nw': 315
        };
        
        let angle = angleMap[handleType];
        if (angle === undefined) return 'default';
        
        // Add object rotation
        angle = (angle + rotation) % 360;
        if (angle < 0) angle += 360;
        
        // Snap to nearest 45 degree
        const snapped = Math.round(angle / 45) * 45 % 360;
        
        // Map back to cursor name
        const cursorMap = {
            0: 'n-resize', 45: 'ne-resize', 90: 'e-resize', 135: 'se-resize',
            180: 's-resize', 225: 'sw-resize', 270: 'w-resize', 315: 'nw-resize'
        };
        
        return cursorMap[snapped] || 'default';
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
        let rotation = 0;
        
        if (selectedElements.length === 1) {
            // Single selection: Use local BBox and apply element's transform to handles
            const el = selectedElements[0];
            try {
                bbox = el.getBBox();
                const transform = el.getAttribute("transform");
                if (transform) {
                    transformGroup.setAttribute("transform", transform);
                    const tData = parseTransform(transform);
                    rotation = tData.rotate;
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
            { x: bbox.x, y: bbox.y, type: "nw" },
            { x: bbox.x + bbox.width, y: bbox.y, type: "ne" },
            { x: bbox.x + bbox.width, y: bbox.y + bbox.height, type: "se" },
            { x: bbox.x, y: bbox.y + bbox.height, type: "sw" },
            // Middle handles
            { x: bbox.x + bbox.width / 2, y: bbox.y, type: "n" },
            { x: bbox.x + bbox.width, y: bbox.y + bbox.height / 2, type: "e" },
            { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height, type: "s" },
            { x: bbox.x, y: bbox.y + bbox.height / 2, type: "w" }
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
            
            // Calculate correct cursor based on rotation
            const cursor = getCursorForHandle(pos.type, rotation);
            handle.style.cursor = cursor;
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
            
            // For path/polygon, width/height/x/y might not exist as attributes
            let initW = 0, initH = 0, initX = 0, initY = 0;
            const bbox = el.getBBox();
            
            if (el.tagName === 'rect' || el.tagName === 'image') {
                initW = parseFloat(el.getAttribute("width"));
                initH = parseFloat(el.getAttribute("height"));
                initX = parseFloat(el.getAttribute("x"));
                initY = parseFloat(el.getAttribute("y"));
            } else {
                // For path, etc., calculate Visual Width/Height based on current scale
                // tData.sx/sy are parsed from the transform string.
                initW = bbox.width * tData.sx;
                initH = bbox.height * tData.sy;
                initX = bbox.x;
                initY = bbox.y;
            }

            elementStates = [{
                el,
                initTx: tData.tx,
                initTy: tData.ty,
                initRot: tData.rotate,
                initCx: tData.cx,
                initCy: tData.cy,
                initSx: tData.sx,
                initSy: tData.sy,
                bbox: bbox,
                initWidth: initW,
                initHeight: initH,
                initX: initX,
                initY: initY,
                initTransform: transform,
                tagName: el.tagName
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

        // Ignore clicks on or inside a foreignObject
        if (target.closest('foreignObject')) {
            return;
        }

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
            captureState(pos);
            evt.stopPropagation();
            return;
        }

        // 3. New Selection
        if (!evt.shiftKey && !evt.ctrlKey) {
            clearSelection();
        }
        
        // Check if clicked on a new selectable element
        if (target !== svg && target.tagName !== 'defs' && target.getAttribute('data-is-grid') !== 'true' && !target.classList.contains('grid-rect')) {
             if (!selectedElements.includes(target)) {
                 selectedElements.push(target);
                 updateTransformHandles();
                 dragMode = 'move';
                 captureState(pos);
                 evt.stopPropagation();
                 return;
             }
        }

        // 4. Start Rubber Band
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
            setCursor(svg, "move");
            if (selectedElements.length === 1) {
                const s = elementStates[0];
                const newTx = s.initTx + dx;
                const newTy = s.initTy + dy;
                
                // Construct new transform
                // We use standard order: translate -> rotate -> scale
                let tStr = `translate(${newTx}, ${newTy})`;
                if (s.initRot) {
                    tStr += ` rotate(${s.initRot}, ${s.initCx || 0}, ${s.initCy || 0})`;
                }
                // Maintain scale if it existed
                if (s.initSx !== 1 || s.initSy !== 1) {
                    tStr += ` scale(${s.initSx}, ${s.initSy})`;
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
                const cx = s.initCx || (s.bbox.x + s.bbox.width/2);
                const cy = s.initCy || (s.bbox.y + s.bbox.height/2);
                
                // Calculate angle relative to center
                // Center in screen space is (cx + tx, cy + ty)
                // Note: If scale is present, center is affected?
                // The cx/cy from parseTransform are in un-rotated space.
                // If scaled, the center logic might need adjustment? 
                // Currently ignoring scale impact on rotation center for simplicity, assuming center of bbox.
                
                const centerX = cx * s.initSx + s.initTx; // Adjusted for scale
                const centerY = cy * s.initSy + s.initTy;
                
                // Actually, if we use the visual center of the bbox:
                const visualCx = (s.bbox.x + s.bbox.width/2) * s.initSx + s.initTx;
                const visualCy = (s.bbox.y + s.bbox.height/2) * s.initSy + s.initTy;
                
                const angle = Math.atan2(pos.y - visualCy, pos.x - visualCx) * 180 / Math.PI + 90;
                
                // Update transform
                let tStr = `translate(${s.initTx}, ${s.initTy}) rotate(${angle}, ${(s.bbox.x + s.bbox.width/2) * s.initSx}, ${(s.bbox.y + s.bbox.height/2) * s.initSy})`;
                if (s.initSx !== 1 || s.initSy !== 1) {
                    // For rotation center to be correct with scale, it's easiest to rotate around scaled center
                    // We updated the rotate center args above.
                    tStr += ` scale(${s.initSx}, ${s.initSy})`;
                }
                
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
                
                // 1. Calculate local delta (rotated to align with element axes)
                let ldx = dx;
                let ldy = dy;
                if (s.initRot) {
                    const rad = s.initRot * Math.PI / 180;
                    const cos = Math.cos(-rad);
                    const sin = Math.sin(-rad);
                    ldx = dx * cos - dy * sin;
                    ldy = dx * sin + dy * cos;
                }
                
                if (s.tagName === 'rect' || s.tagName === 'image') {
                    // Existing Rect Logic (omitted for brevity, unchanged)
                    let anchorX = s.initX;
                    let anchorY = s.initY;
                    
                    if (resizeHandle.includes('w')) anchorX = s.initX + s.initWidth;
                    if (resizeHandle.includes('n')) anchorY = s.initY + s.initHeight;
                    
                    const globalAnchor = rotatePoint(anchorX, anchorY, s.initCx || (s.bbox.x + s.bbox.width/2), s.initCy || (s.bbox.y + s.bbox.height/2), s.initRot);
                    globalAnchor.x += s.initTx;
                    globalAnchor.y += s.initTy;
                    
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
                    
                    const newCX = newX + newW / 2;
                    const newCY = newY + newH / 2;
                    
                    const rotatedAnchor = rotatePoint(anchorX, anchorY, newCX, newCY, s.initRot);
                    
                    const newTx = globalAnchor.x - rotatedAnchor.x;
                    const newTy = globalAnchor.y - rotatedAnchor.y;
                    
                    s.el.setAttribute('x', newX);
                    s.el.setAttribute('y', newY);
                    s.el.setAttribute('width', newW);
                    s.el.setAttribute('height', newH);
                    
                    const tStr = `translate(${newTx}, ${newTy}) rotate(${s.initRot}, ${newCX}, ${newCY})`;
                    s.el.setAttribute("transform", tStr);
                    transformGroup.setAttribute("transform", tStr);
                    
                    updateTransformHandles();
                } else {
                    // Path/Polygon Resize Logic using Scale
                    
                    // 1. Calculate new Visual Width/Height
                    // s.initWidth is the visual width at start of drag (includes previous scale)
                    let newVisualW = s.initWidth;
                    let newVisualH = s.initHeight;
                    
                    if (resizeHandle.includes('e')) newVisualW += ldx;
                    if (resizeHandle.includes('s')) newVisualH += ldy;
                    if (resizeHandle.includes('w')) newVisualW -= ldx;
                    if (resizeHandle.includes('n')) newVisualH -= ldy;
                    
                    // Avoid zero/negative size
                    if (newVisualW < 1) newVisualW = 1;
                    if (newVisualH < 1) newVisualH = 1;
                    
                    // 2. Calculate New Scale Factors
                    // Scale relative to the original local bbox
                    const sx = newVisualW / s.bbox.width;
                    const sy = newVisualH / s.bbox.height;
                    
                    // 3. Anchor Logic to calculate new Translation
                    // We need to keep the Anchor Point fixed in Global Space.
                    
                    // Determine Anchor Point in "Scaled Local Space" (Visual Space before Rotation)
                    // If resizing West, Anchor is East.
                    let anchorLocalX_scaled = s.initX * s.initSx; // Start with old visual pos
                    let anchorLocalY_scaled = s.initY * s.initSy;
                    
                    if (resizeHandle.includes('w')) anchorLocalX_scaled = (s.initX + s.bbox.width) * s.initSx; // East edge (old visual)
                    if (resizeHandle.includes('n')) anchorLocalY_scaled = (s.initY + s.bbox.height) * s.initSy; // South edge (old visual)
                    
                    // Global Anchor Position (Fixed)
                    // Apply Rotate + Translate to the scaled anchor
                    // Center of rotation for the object is the visual center
                    const oldVisualCx = (s.bbox.x + s.bbox.width/2) * s.initSx;
                    const oldVisualCy = (s.bbox.y + s.bbox.height/2) * s.initSy;
                    
                    const globalAnchor = rotatePoint(anchorLocalX_scaled, anchorLocalY_scaled, oldVisualCx, oldVisualCy, s.initRot);
                    globalAnchor.x += s.initTx;
                    globalAnchor.y += s.initTy;
                    
                    // New Local Anchor Position (after NEW scale)
                    // If resizing West, Anchor is East. East edge corresponds to (bbox.x + bbox.width).
                    // So in new scaled space, it is at (bbox.x + bbox.width) * sx.
                    let newAnchorX_scaled = s.initX * sx;
                    let newAnchorY_scaled = s.initY * sy;
                    
                    if (resizeHandle.includes('w')) newAnchorX_scaled = (s.initX + s.bbox.width) * sx;
                    if (resizeHandle.includes('n')) newAnchorY_scaled = (s.initY + s.bbox.height) * sy;
                    
                    // New Center of rotation (Visual Center with new scale)
                    const newVisualCx = (s.bbox.x + s.bbox.width/2) * sx;
                    const newVisualCy = (s.bbox.y + s.bbox.height/2) * sy;
                    
                    // Calculate where this new anchor would be if we just rotated (without new translation)
                    const rotatedNewAnchor = rotatePoint(newAnchorX_scaled, newAnchorY_scaled, newVisualCx, newVisualCy, s.initRot);
                    
                    // The difference is the new Translation needed
                    const newTx = globalAnchor.x - rotatedNewAnchor.x;
                    const newTy = globalAnchor.y - rotatedNewAnchor.y;
                    
                    // Construct final transform
                    // translate(newTx, newTy) rotate(angle, newVisualCx, newVisualCy) scale(sx, sy)
                    // Note: SVG rotate(a, cx, cy) is around (cx, cy) in the user space *before* rotation.
                    // Since we apply scale *after* rotate in string order (right-to-left application? NO).
                    // SVG transform="translate T rotate R scale S" means T * R * S * point.
                    // So Scale is applied first.
                    // Then Rotate is applied. The center (cx, cy) for rotate must be in the SCALED space.
                    // Yes, newVisualCx/Cy are in scaled space.
                    
                    const tStr = `translate(${newTx}, ${newTy}) rotate(${s.initRot}, ${newVisualCx}, ${newVisualCy}) scale(${sx}, ${sy})`;
                    
                    s.el.setAttribute("transform", tStr);
                    
                    transformGroup.setAttribute("transform", tStr);
                    updateTransformHandles();
                }
            } else {
                // Multi Element Resize (unchanged)
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
                
                const tx = newX - groupBounds.x * sx;
                const ty = newY - groupBounds.y * sy;
                
                selectedElements.forEach((el, i) => {
                    const s = elementStates[i];
                    el.setAttribute("transform", `translate(${tx}, ${ty}) scale(${sx}, ${sy}) ${s.initTransform}`);
                });
                
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
                if (el.tagName === 'defs' || el.tagName === 'g' || el.tagName === 'foreignObject' || el.id === 'grid-background' || el.getAttribute('data-is-grid') === 'true') continue;
                
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
        if (transformGroup && transformGroup.parentNode) transformGroup.parentNode.removeChild(transformGroup);
        if (selectionRect && selectionRect.parentNode) selectionRect.parentNode.removeChild(selectionRect);
    };
}
