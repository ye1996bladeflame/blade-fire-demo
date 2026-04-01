export const SVG_NS = "http://www.w3.org/2000/svg";

let globalShapeStyle = {
    "fill": "rgba(100, 149, 237, 0.3)",
    "stroke": "#6495ED",
    "stroke-width": "1"
};

let toolStyles = {
    circle: { fill: "rgba(255, 99, 71, 0.3)", stroke: "#FF6347" },
    ellipse: { fill: "rgba(255, 99, 71, 0.3)", stroke: "#FF6347" },
    text: { fill: "rgb(51, 51, 51)", stroke: "none", "stroke-width": "0" },
    freehand: { fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" },
    polygon: {},
    triangle: {},
    rect: {}
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
 * @param {string} tag - SVG 标签名 (如 'rect', 'circle', 'path')
 * @param {object} attrs - 自定义属性和样式 (可以传入 fill, stroke 等覆盖默认值)
 * @returns {SVGElement} - 创建好的 SVG 元素
 */
export function createShape(tag, attrs = {}) {
    const el = document.createElementNS(SVG_NS, tag);
    
    const finalAttrs = { ...attrs };

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

    return el;
}
