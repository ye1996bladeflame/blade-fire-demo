import { SVG_NS, generateUID } from './element.js';
import { parseTransform } from './transform.js';

/**
 * 序列化元素供剪贴板使用（不含 uid，粘贴时会重新生成）。
 */
export function serializeElementForClipboard(el) {
  const attrs = {};
  for (let i = 0; i < el.attributes.length; i++) {
    const attr = el.attributes[i];
    if (attr.name === 'uid') continue;
    attrs[attr.name] = attr.value;
  }
  /** @type {{ tagName: string, attributes: Record<string, string>, innerHTML?: string, textContent?: string }} */
  const item = {
    tagName: el.tagName,
    attributes: attrs,
  };
  if (el.tagName === 'text') {
    item.textContent = el.textContent;
  } else if (el.innerHTML) {
    item.innerHTML = el.innerHTML;
  }
  return item;
}

/**
 * 将剪贴板内容粘贴到 SVG，并为每个新元素分配唯一 uid。
 * @returns {SVGElement[]} 新创建的元素
 */
export function pasteFromClipboard(svg, clipboard, offsetX, offsetY) {
  if (!clipboard?.elements?.length) return [];

  const newElements = [];

  clipboard.elements.forEach((item) => {
    const newEl = document.createElementNS(SVG_NS, item.tagName);

    Object.keys(item.attributes).forEach((key) => {
      if (key === 'uid') return;
      newEl.setAttribute(key, item.attributes[key]);
    });

    newEl.setAttribute('uid', generateUID());

    if (item.textContent !== undefined) {
      newEl.textContent = item.textContent;
    } else if (item.innerHTML) {
      newEl.innerHTML = item.innerHTML;
    }

    applyPasteOffset(newEl, offsetX, offsetY);
    svg.appendChild(newEl);
    newElements.push(newEl);
  });

  return newElements;
}

function applyPasteOffset(el, offsetX, offsetY) {
  const tag = el.tagName.toLowerCase();

  if (tag === 'rect' || tag === 'image') {
    const x = parseFloat(el.getAttribute('x') || '0');
    const y = parseFloat(el.getAttribute('y') || '0');
    el.setAttribute('x', String(x + offsetX));
    el.setAttribute('y', String(y + offsetY));
    return;
  }

  if (tag === 'ellipse' || tag === 'circle') {
    const cx = parseFloat(el.getAttribute('cx') || '0');
    const cy = parseFloat(el.getAttribute('cy') || '0');
    el.setAttribute('cx', String(cx + offsetX));
    el.setAttribute('cy', String(cy + offsetY));
    return;
  }

  const transform = el.getAttribute('transform') || '';
  if (transform || tag === 'text' || tag === 'path') {
    const tData = parseTransform(transform);
    tData.tx += offsetX;
    tData.ty += offsetY;

    let tStr = `translate(${tData.tx}, ${tData.ty})`;
    if (tData.rotate) {
      tStr += ` rotate(${tData.rotate}, ${tData.cx}, ${tData.cy})`;
    }
    if (tData.sx !== 1 || tData.sy !== 1) {
      tStr += ` scale(${tData.sx}, ${tData.sy})`;
    }
    el.setAttribute('transform', tStr);
  }
}
