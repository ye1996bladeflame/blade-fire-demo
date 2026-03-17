import { setCursor } from "../common/index.js";

export function enablePan(svg) {
    let isDragging = false;
    let startX, startY;
    let viewBox = { x: 0, y: 0, w: 0, h: 0 };
    let originalCursor = "";

    function updateGridRect() {
        const gridRect = svg.querySelector('.grid-rect');
        if (gridRect) {
            gridRect.setAttribute('x', viewBox.x);
            gridRect.setAttribute('y', viewBox.y);
            gridRect.setAttribute('width', viewBox.w);
            gridRect.setAttribute('height', viewBox.h);
        }
    }

    function onMouseDown(evt) {
        // Middle mouse button
        if (evt.button !== 1) return;

        evt.preventDefault();
        isDragging = true;
        startX = evt.clientX;
        startY = evt.clientY;

        // Change cursor
        originalCursor = svg.style.cursor;
        setCursor(svg, "grabbing");

        // Get current viewBox
        const vb = svg.getAttribute("viewBox").split(' ').map(Number);
        viewBox = { x: vb[0], y: vb[1], w: vb[2], h: vb[3] };
    }

    function onMouseMove(evt) {
        if (!isDragging) return;

        evt.preventDefault();

        // Calculate delta
        const dx = evt.clientX - startX;
        const dy = evt.clientY - startY;

        // Calculate scale factor (SVG units per screen pixel)
        // This ensures dragging matches mouse movement regardless of zoom
        const rect = svg.getBoundingClientRect();
        const scaleX = viewBox.w / rect.width;
        const scaleY = viewBox.h / rect.height;

        viewBox.x -= dx * scaleX;
        viewBox.y -= dy * scaleY;

        svg.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`);
        updateGridRect();

        // Update start position
        startX = evt.clientX;
        startY = evt.clientY;
    }

    function onMouseUp(evt) {
        if (isDragging && evt.button === 1) {
            isDragging = false;
            // Restore cursor
            setCursor(svg, originalCursor);
        }
    }

    // Attach listeners
    svg.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove); // Window to catch drag outside
    window.addEventListener("mouseup", onMouseUp);

    // Return cleanup function
    return () => {
        svg.removeEventListener("mousedown", onMouseDown);
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
    };
}
