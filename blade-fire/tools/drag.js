import { setCursor } from "../common/index.js";

export function enableDrag(svg) {
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
        // Only middle mouse button (button 1)
        if (evt.button !== 1) return;

        evt.preventDefault();
        isDragging = true;
        startX = evt.clientX;
        startY = evt.clientY;

        // Store original cursor and set grabbing cursor
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

        // Update viewBox based on delta and current scale
        // We need to account for the current zoom level (scale)
        const rect = svg.getBoundingClientRect();
        const scaleX = viewBox.w / rect.width;
        const scaleY = viewBox.h / rect.height;

        viewBox.x -= dx * scaleX;
        viewBox.y -= dy * scaleY;

        svg.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`);
        updateGridRect();

        // Update start positions for next move event
        startX = evt.clientX;
        startY = evt.clientY;
    }

    function onMouseUp(evt) {
        if (isDragging && evt.button === 1) {
            isDragging = false;
            // Restore original cursor
            setCursor(svg, originalCursor);
        }
    }

    // Add event listeners
    svg.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove); // Use window to handle drag outside svg
    window.addEventListener("mouseup", onMouseUp);

    // Return cleanup function (though this is a global feature, usually not cleaned up unless destroyed)
    return () => {
        svg.removeEventListener("mousedown", onMouseDown);
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
    };
}