
export function createRuler(container, svg) {
    const rulerSize = 20;
    const rulerBg = '#f9f9f9';
    const rulerFg = '#333';
    const rulerFont = '10px sans-serif';

    // Create container for rulers
    const rulerContainer = document.createElement('div');
    rulerContainer.style.position = 'absolute';
    rulerContainer.style.top = '0';
    rulerContainer.style.left = '0';
    rulerContainer.style.width = '100%';
    rulerContainer.style.height = '100%';
    rulerContainer.style.pointerEvents = 'none';
    rulerContainer.style.overflow = 'hidden';
    rulerContainer.style.zIndex = '100';
    rulerContainer.style.display = 'none';

    // Horizontal Ruler
    const hCanvas = document.createElement('canvas');
    hCanvas.style.position = 'absolute';
    hCanvas.style.top = '0';
    hCanvas.style.left = `${rulerSize}px`;
    hCanvas.style.pointerEvents = 'none';
    hCanvas.height = rulerSize;
    
    // Vertical Ruler
    const vCanvas = document.createElement('canvas');
    vCanvas.style.position = 'absolute';
    vCanvas.style.left = '0';
    vCanvas.style.top = `${rulerSize}px`;
    vCanvas.style.pointerEvents = 'none';
    vCanvas.width = rulerSize;

    // Corner
    const corner = document.createElement('div');
    corner.style.position = 'absolute';
    corner.style.top = '0';
    corner.style.left = '0';
    corner.style.width = `${rulerSize}px`;
    corner.style.height = `${rulerSize}px`;
    corner.style.backgroundColor = rulerBg;
    corner.style.borderBottom = '1px solid #ccc';
    corner.style.borderRight = '1px solid #ccc';
    corner.style.boxSizing = 'border-box';
    corner.style.pointerEvents = 'none';
    
    rulerContainer.appendChild(hCanvas);
    rulerContainer.appendChild(vCanvas);
    rulerContainer.appendChild(corner);
    
    // Ensure container positioning
    const computedStyle = getComputedStyle(container);
    if (computedStyle.position === 'static') {
        container.style.position = 'relative';
    }
    
    container.appendChild(rulerContainer);

    let isEnabled = false;

    const drawRuler = (canvas, isHorizontal, startUnit, scale) => {
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = rulerBg;
        ctx.fillRect(0, 0, width, height);
        
        ctx.fillStyle = rulerFg;
        ctx.font = rulerFont;
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#ccc';

        // Draw border
        ctx.beginPath();
        if (isHorizontal) {
            ctx.moveTo(0, height);
            ctx.lineTo(width, height);
        } else {
            ctx.moveTo(width, 0);
            ctx.lineTo(width, height);
        }
        ctx.stroke();
        
        ctx.strokeStyle = '#999';
        
        // Determine step size
        // Scale is units per pixel
        const pixelsPerTick = 100;
        const unitsPerTick = pixelsPerTick * scale;
        
        const power = Math.floor(Math.log10(unitsPerTick));
        const base = Math.pow(10, power);
        let step = base;
        if (unitsPerTick / base >= 2) step = 2 * base;
        if (unitsPerTick / base >= 5) step = 5 * base;
        
        // Prevent infinite loop if step is invalid
        if (step <= 0 || !isFinite(step)) step = 10;

        // Draw ticks
        const maxPos = isHorizontal ? width : height;
        
        const numSubSteps = 10;
        const subStep = step / numSubSteps;
        const firstTickIndex = Math.ceil(startUnit / subStep);
        
        for (let i = 0; ; i++) {
            const u = (firstTickIndex + i) * subStep;
            const pos = (u - startUnit) / scale;
            if (pos > maxPos + 50) break; // Allow some overflow
            
            const isMajor = (firstTickIndex + i) % numSubSteps === 0;
            const isHalf = (firstTickIndex + i) % (numSubSteps / 2) === 0;
            
            ctx.beginPath();
            const tickLen = isMajor ? 6 : (isHalf ? 4 : 2);
            
            if (isHorizontal) {
                ctx.moveTo(pos, height);
                ctx.lineTo(pos, height - tickLen);
                if (isMajor) {
                    ctx.fillText(Math.round(u * 100) / 100, pos + 2, height - 2);
                }
            } else {
                ctx.moveTo(width, pos);
                ctx.lineTo(width - tickLen, pos);
                
                if (isMajor) {
                    ctx.save();
                    ctx.translate(width - 2, pos + 2);
                    ctx.rotate(-Math.PI / 2);
                    ctx.fillText(Math.round(u * 100) / 100, 0, 0);
                    ctx.restore();
                }
            }
            ctx.stroke();
        }
    };

    const update = () => {
        if (!isEnabled) return;
        
        let vb = svg.getAttribute('viewBox');
        if (!vb) return;
        
        const [x, y, w, h] = vb.split(' ').map(Number);
        
        const rect = container.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        
        if (width === 0 || height === 0) return;

        // Resize canvases
        const hW = Math.max(0, width - rulerSize);
        const vH = Math.max(0, height - rulerSize);
        
        if (hCanvas.width !== hW) hCanvas.width = hW;
        if (vCanvas.height !== vH) vCanvas.height = vH;
        
        hCanvas.style.width = `${hW}px`;
        vCanvas.style.height = `${vH}px`;

        const scaleX = w / width;
        const scaleY = h / height;
        
        // Draw
        drawRuler(hCanvas, true, x + rulerSize * scaleX, scaleX);
        drawRuler(vCanvas, false, y + rulerSize * scaleY, scaleY);
    };

    const observer = new MutationObserver(update);
    observer.observe(svg, { attributes: true, attributeFilter: ['viewBox'] });
    
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(container);

    return {
        enable: () => {
            isEnabled = true;
            rulerContainer.style.display = 'block';
            update();
        },
        disable: () => {
            isEnabled = false;
            rulerContainer.style.display = 'none';
        },
        destroy: () => {
            observer.disconnect();
            resizeObserver.disconnect();
            if (rulerContainer.parentNode) rulerContainer.parentNode.removeChild(rulerContainer);
        }
    };
}
