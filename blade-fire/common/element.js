export const SVG_NS = "http://www.w3.org/2000/svg";

let globalShapeStyle = {
    "fill": "rgba(100, 149, 237, 0.3)",
    "stroke": "#6495ED",
    "stroke-width": "1"
};

let toolStyles = {
    circle: { fill: "rgba(255, 99, 71, 0.3)", stroke: "#FF6347" },
    ellipse: { fill: "rgba(255, 99, 71, 0.3)", stroke: "#FF6347" },
    pathEllipse: {},
    text: { fill: "rgb(51, 51, 51)", stroke: "none", "stroke-width": "0" },
    freehand: { fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" },
    polygon: {},
    triangle: {},
    rect: {},
    "rotate-rect": {}
};

export function setGlobalStyle(style) {
    globalShapeStyle = { ...globalShapeStyle, ...style };
}

export function setToolStyle(toolName, style) {
    toolStyles[toolName] = { ...toolStyles[toolName], ...style };
}

export function getToolStyle(toolName) {
    return { ...globalShapeStyle, ...(toolStyles[toolName] || {}) };
}

export function generateUID() {
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 9);
}

/**
 * 创建 SVG 图形元素并支持自定义属性
 * @param {string} tag - SVG 标签名 (如 'rect', 'circle', 'path', 'image')
 * @param {object} attrs - 自定义属性和样式 (可以传入 fill, stroke 等覆盖默认值)
 *   image 用法：createShape('image', { href: 'https://... 或 data:image/...;base64,...', width, height })
 *   - 不传 width/height 时自动取图片原始尺寸；不传 x/y 时自动在画布中居中
 * @returns {SVGElement} - 创建好的 SVG 元素
 */
export function createShape(tag, attrs = {}) {
    const el = document.createElementNS(SVG_NS, tag);

    const finalAttrs = { ...attrs };

    // 兼容 src 写法，统一为 SVG image 的 href
    if (!finalAttrs.href && finalAttrs.src) {
        finalAttrs.href = finalAttrs.src;
        delete finalAttrs.src;
    }

    // 自动生成唯一 uid
    if (!finalAttrs.uid && !finalAttrs.id) {
        finalAttrs.uid = generateUID();
    }

    // 设置属性
    for (const key in finalAttrs) {
        if (finalAttrs[key] !== null && finalAttrs[key] !== undefined) {
            el.setAttribute(key, finalAttrs[key]);
        }
    }

    if (tag === 'image' && finalAttrs.href) {
        centerImage(el, finalAttrs);
    }

    return el;
}

/**
 * 图片自动居中到画布中心（对齐 AlignManager 的居中思路，简化为直接计算 viewBox 中心）。
 * 显式传入 x/y 时跳过居中，尊重用户指定位置。
 */
function centerImage(el, attrs) {
    const center = () => {
        const svg = el.closest('svg');
        if (!svg || (attrs.x !== undefined && attrs.y !== undefined)) return;
        const vb = svg.viewBox?.baseVal;
        const cx = vb?.width ? vb.x + vb.width / 2 : svg.clientWidth / 2;
        const cy = vb?.height ? vb.y + vb.height / 2 : svg.clientHeight / 2;
        el.setAttribute('x', cx - parseFloat(el.getAttribute('width')) / 2);
        el.setAttribute('y', cy - parseFloat(el.getAttribute('height')) / 2);
    };

    // 初始化完成（尺寸就绪 + 居中）后通知调用方，用于把导入的图片同步进历史基线
    const ready = () => el.dispatchEvent(new CustomEvent('blade-shape-ready'));

    // 等元素挂载到 SVG 后再计算中心；未指定尺寸时先等图片加载取得原始宽高
    requestAnimationFrame(() => {
        if (attrs.width !== undefined && attrs.height !== undefined) {
            center();
            ready();
            return;
        }
        const img = new Image();
        img.onload = () => {
            if (attrs.width === undefined) el.setAttribute('width', img.naturalWidth);
            if (attrs.height === undefined) el.setAttribute('height', img.naturalHeight);
            center();
            ready();
        };
        img.onerror = ready;
        img.src = attrs.href;
    });
}
