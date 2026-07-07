
import { createListenerManager } from '../common/index.js';

export function createCrosshair(container) {
    // Create elements
    const hLine = document.createElement('div');
    const vLine = document.createElement('div');

    // Style them
    const lineStyle = {
        position: 'absolute',
        pointerEvents: 'none',
        display: 'none',
        zIndex: '1000' // Ensure on top
    };

    Object.assign(hLine.style, lineStyle);
    hLine.style.borderTop = '1px dashed #87CEEB';
    hLine.style.width = '100%';
    hLine.style.height = '0';
    hLine.style.left = '0';

    Object.assign(vLine.style, lineStyle);
    vLine.style.borderLeft = '1px dashed #87CEEB';
    vLine.style.width = '0';
    vLine.style.height = '100%';
    vLine.style.top = '0';

    // Ensure container is positioned
    const computedStyle = getComputedStyle(container);
    if (computedStyle.position === 'static') {
        container.style.position = 'relative';
    }

    container.appendChild(hLine);
    container.appendChild(vLine);

    let isEnabled = false;

    const onMouseMove = (e) => {
        if (!isEnabled) return;

        const rect = container.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Check bounds
        if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
            hLine.style.top = `${y}px`;
            vLine.style.left = `${x}px`;
            hLine.style.display = 'block';
            vLine.style.display = 'block';
        } else {
            hLine.style.display = 'none';
            vLine.style.display = 'none';
        }
    };

    const onMouseLeave = () => {
        if (!isEnabled) return;
        hLine.style.display = 'none';
        vLine.style.display = 'none';
    };

    const listeners = createListenerManager();
    listeners.on(container, 'mousemove', onMouseMove);
    listeners.on(container, 'mouseleave', onMouseLeave);

    return {
        enable: () => {
            isEnabled = true;
        },
        disable: () => {
            isEnabled = false;
            hLine.style.display = 'none';
            vLine.style.display = 'none';
        },
        destroy: () => {
            listeners.dispose();
            if (hLine.parentNode) hLine.parentNode.removeChild(hLine);
            if (vLine.parentNode) vLine.parentNode.removeChild(vLine);
        }
    };
}
