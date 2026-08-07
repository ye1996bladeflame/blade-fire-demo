
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

export function refreshGrid(svg, viewBox) {
  const gridRect = svg.querySelector('.grid-rect');
  if (!gridRect) return;

  gridRect.setAttribute('x', viewBox.x - viewBox.w);
  gridRect.setAttribute('y', viewBox.y - viewBox.h);
  gridRect.setAttribute('width', viewBox.w * 3);
  gridRect.setAttribute('height', viewBox.h * 3);

  const gridPath = svg.querySelector('#grid path');
  const gridPattern = svg.querySelector('#grid');
  if (gridPath && gridPattern && svg.clientWidth > 0) {
    const strokeWidth = viewBox.w / svg.clientWidth;
    gridPath.setAttribute('stroke-width', strokeWidth);

    const gridSize = parseFloat(gridPattern.getAttribute('width'));
    const apparentSize = gridSize * (svg.clientWidth / viewBox.w);

    if (apparentSize < 4) {
      gridRect.style.visibility = 'hidden';
    } else {
      gridRect.style.visibility = 'visible';
    }
  }
}

export function enableZoom(svg) {
  let viewBox = { x: 0, y: 0, w: svg.clientWidth, h: svg.clientHeight };
  const zoomSensitivity = 0.002;


  if (!svg.getAttribute("viewBox")) {
    svg.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`);
  } else {
    const vb = svg.getAttribute("viewBox").split(' ').map(Number);
    viewBox = { x: vb[0], y: vb[1], w: vb[2], h: vb[3] };
  }

  const updateGridRect = () => {
    refreshGrid(svg, viewBox);
  };

  updateGridRect();


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


    const currentVB = svg.getAttribute("viewBox").split(' ').map(Number);
    viewBox = { x: currentVB[0], y: currentVB[1], w: currentVB[2], h: currentVB[3] };

    const rect = svg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;




    const zoomFactor = Math.max(0.05, 1 + e.deltaY * zoomSensitivity);

    const newW = viewBox.w * zoomFactor;
    const newH = viewBox.h * zoomFactor;



    const mx = mouseX / rect.width * viewBox.w + viewBox.x;
    const my = mouseY / rect.height * viewBox.h + viewBox.y;

    viewBox.x = mx - (mx - viewBox.x) * zoomFactor;
    viewBox.y = my - (my - viewBox.y) * zoomFactor;
    viewBox.w = newW;
    viewBox.h = newH;

    svg.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`);
    updateGridRect();
  });
}

export function setCursor(svg, cursor) {
  svg.style.cursor = cursor;
}

export function getOverlayLayer(svg) {

  return svg;
}
export { history } from './history.js';
export { undoRedoManager } from './undo-redo.js';
export { captureScene, applyScene, applyPartial, computePatch, isContentNode } from './scene.js';
export { parseTransform } from './transform.js';
export { serializeElementForClipboard, pasteFromClipboard } from './clipboard.js';
export { createShape, SVG_NS, getToolStyle, setToolStyle, setGlobalStyle, generateUID } from './element.js';
export { createListenerManager } from './listeners.js';
export { parsePathData, buildPathData, isClosedPolygonPath } from './path-utils.js';
export { createPathEditor } from './path-editor.js';

let clipboard = null;
export function setClipboard(data) {
  clipboard = data;
}
export function getClipboard() {
  return clipboard;
}

export function getMousePosition(svg, evt) {
    const CTM = svg.getScreenCTM();
    if (!CTM) return { x: 0, y: 0 };
    return {
        x: (evt.clientX - CTM.e) / CTM.a,
        y: (evt.clientY - CTM.f) / CTM.d
    };
}

export { getDrawingArea, clampPoint, clampRect, clampMove } from './draw-area.js';
// 兼容旧写法：clampToDrawingArea 等价于 clampPoint
export { clampPoint as clampToDrawingArea } from './draw-area.js';
