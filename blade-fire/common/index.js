// 创建网格
export function createGrid(svg, width, height, gridSize) {
  const svgNS = "http://www.w3.org/2000/svg";
  const defs = document.createElementNS(svgNS, "defs");

  const pattern = document.createElementNS(svgNS, "pattern");
  pattern.setAttribute("id", "grid");
  pattern.setAttribute("width", gridSize);
  pattern.setAttribute("height", gridSize);
  pattern.setAttribute("patternUnits", "userSpaceOnUse");

  const path = document.createElementNS(svgNS, "path");
  path.setAttribute("d", `M ${gridSize} 0 L 0 0 0 ${gridSize}`);
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "rgba(204,204,204,0.5)");
  path.setAttribute("stroke-width", "1");

  pattern.appendChild(path);
  defs.appendChild(pattern);
  svg.appendChild(defs);

  const rect = document.createElementNS(svgNS, "rect");
  rect.setAttribute("class", "grid-rect");
  rect.setAttribute("id", "grid-background");
  rect.setAttribute("data-is-grid", "true");
  rect.setAttribute("width", "100%");
  rect.setAttribute("height", "100%");
  rect.setAttribute("fill", "url(#grid)");

  svg.appendChild(rect);
}
// 启用缩放功能
export function enableZoom(svg) {
  let viewBox = { x: 0, y: 0, w: svg.clientWidth, h: svg.clientHeight };
  const zoomSensitivity = 0.002;

  // Helper to update grid rect
  const updateGridRect = () => {
    const gridRect = svg.querySelector('.grid-rect');
    if (gridRect) {
      gridRect.setAttribute('x', viewBox.x);
      gridRect.setAttribute('y', viewBox.y);
      gridRect.setAttribute('width', viewBox.w);
      gridRect.setAttribute('height', viewBox.h);
    }
  };

  // Initialize viewBox
  if (!svg.getAttribute("viewBox")) {
      svg.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`);
  } else {
      const vb = svg.getAttribute("viewBox").split(' ').map(Number);
      viewBox = { x: vb[0], y: vb[1], w: vb[2], h: vb[3] };
  }
  
  // Initial update
  updateGridRect();

  // ResizeObserver to handle container resize
  let prevWidth = svg.clientWidth;
  let prevHeight = svg.clientHeight;
  const resizeObserver = new ResizeObserver(entries => {
    for (const entry of entries) {
      const { width, height } = entry.contentRect;
      if (width === 0 || height === 0) return;

      if (prevWidth === 0 || prevHeight === 0) {
          viewBox.w = width;
          viewBox.h = height;
      } else {
          const scaleX = viewBox.w / prevWidth;
          const scaleY = viewBox.h / prevHeight;
          viewBox.w = width * scaleX;
          viewBox.h = height * scaleY;
      }
      
      svg.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`);
      updateGridRect();
      
      prevWidth = width;
      prevHeight = height;
    }
  });
  resizeObserver.observe(svg);

  svg.addEventListener('wheel', (e) => {
    e.preventDefault();

    // Always get the latest viewBox from the DOM to sync with other tools (like drag)
    const currentVB = svg.getAttribute("viewBox").split(' ').map(Number);
    viewBox = { x: currentVB[0], y: currentVB[1], w: currentVB[2], h: currentVB[3] };

    const rect = svg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Calculate zoom factor
    // e.deltaY > 0 -> zoom out (factor > 1)
    // e.deltaY < 0 -> zoom in (factor < 1)
    const zoomFactor = 1 + e.deltaY * zoomSensitivity;

    // New dimensions
    const newW = viewBox.w * zoomFactor;
    const newH = viewBox.h * zoomFactor;

    // Calculate offset to keep mouse position stable
    const dw = viewBox.w - newW;
    const dh = viewBox.h - newH;

    viewBox.x += (mouseX / rect.width) * dw;
    viewBox.y += (mouseY / rect.height) * dh;
    viewBox.w = newW;
    viewBox.h = newH;

    svg.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`);
    updateGridRect();
  });
}
// 自定义手势
export function setCursor(svg, cursor) {
  if (!svg) return;
  
  // 如果是自定义图片 URL
  if (cursor.includes('.') || cursor.includes('data:image')) {
    svg.style.cursor = `url(${cursor}), auto`;
  } else {
    // 原生光标样式 (如 'pointer', 'crosshair', 'move', 'default' 等)
    svg.style.cursor = cursor;
  }
}

// 创建或获取覆盖层 (foreignObject)
export function getOverlayLayer(svg) {
    const svgNS = "http://www.w3.org/2000/svg";
    let fo = svg.querySelector('#overlay-layer');
    if (!fo) {
        fo = document.createElementNS(svgNS, "foreignObject");
        fo.setAttribute("id", "overlay-layer");
        fo.setAttribute("width", "100%");
        fo.setAttribute("height", "100%");
        fo.setAttribute("style", "pointer-events: none; position: absolute; top: 0; left: 0; overflow: visible;");
        
        // Ensure it's on top of everything
        svg.appendChild(fo);
    } else {
        // Move to top if not
        if (svg.lastElementChild !== fo) {
            svg.appendChild(fo);
        }
    }
    
    // Create container div inside if not exists
    let container = fo.firstElementChild;
    if (!container) {
        container = document.createElement("div");
        container.style.width = "100%";
        container.style.height = "100%";
        container.style.position = "relative";
        container.style.pointerEvents = "none";
        fo.appendChild(container);
    }
    
    return container;
}