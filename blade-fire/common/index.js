
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

export function enableZoom(svg) {
  let viewBox = { x: 0, y: 0, w: svg.clientWidth, h: svg.clientHeight };
  const zoomSensitivity = 0.002;


  const updateGridRect = () => {
    const gridRect = svg.querySelector('.grid-rect');
    if (gridRect) {
      gridRect.setAttribute('x', viewBox.x);
      gridRect.setAttribute('y', viewBox.y);
      gridRect.setAttribute('width', viewBox.w);
      gridRect.setAttribute('height', viewBox.h);
    }
  };


  if (!svg.getAttribute("viewBox")) {
    svg.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`);
  } else {
    const vb = svg.getAttribute("viewBox").split(' ').map(Number);
    viewBox = { x: vb[0], y: vb[1], w: vb[2], h: vb[3] };
  }


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




    const zoomFactor = 1 + e.deltaY * zoomSensitivity;




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


export class History {
  constructor() {
    this.undoStack = [];
    this.redoStack = [];
  }

  push(action) {

    this.undoStack.push(action);
    this.redoStack = [];
    console.log("History push", action);
  }

  undo() {
    if (this.undoStack.length === 0) return;
    const action = this.undoStack.pop();
    this.redoStack.push(action);
    if (action.undo) action.undo();
    console.log("Undo", action);
  }

  redo() {
    if (this.redoStack.length === 0) return;
    const action = this.redoStack.pop();
    this.undoStack.push(action);
    if (action.redo) action.redo();
    console.log("Redo", action);
  }
}

export const history = new History();

let clipboard = null;
export function setClipboard(data) {
  clipboard = data;
}
export function getClipboard() {
  return clipboard;
}

export function parseTransform(transformStr) {
    const result = { tx: 0, ty: 0, rotate: 0, cx: 0, cy: 0, sx: 1, sy: 1 };
    if (!transformStr) return result;
    
    const tMatch = transformStr.match(/translate\s*\(\s*([-\d.e]+)\s*[,\s]\s*([-\d.e]+)\s*\)/);
    if (tMatch) {
        result.tx = parseFloat(tMatch[1]);
        result.ty = parseFloat(tMatch[2]);
    }
    
    const rMatch = transformStr.match(/rotate\s*\(\s*([-\d.e]+)(?:\s*[,\s]\s*([-\d.e]+)\s*[,\s]\s*([-\d.e]+))?\s*\)/);
    if (rMatch) {
        result.rotate = parseFloat(rMatch[1]);
        if (rMatch[2] !== undefined) result.cx = parseFloat(rMatch[2]);
        if (rMatch[3] !== undefined) result.cy = parseFloat(rMatch[3]);
    }
    
    const sMatch = transformStr.match(/scale\s*\(\s*([-\d.e]+)(?:\s*[,\s]\s*([-\d.e]+))?\s*\)/);
    if (sMatch) {
        result.sx = parseFloat(sMatch[1]);
        result.sy = sMatch[2] !== undefined ? parseFloat(sMatch[2]) : result.sx;
    }
    
    return result;
}

export function getMousePosition(svg, evt) {
    const CTM = svg.getScreenCTM();
    if (!CTM) return { x: 0, y: 0 };
    return {
        x: (evt.clientX - CTM.e) / CTM.a,
        y: (evt.clientY - CTM.f) / CTM.d
    };
}
