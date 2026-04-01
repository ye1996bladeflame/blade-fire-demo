export const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * 创建 SVG 图形元素并支持自定义属性
 * @param {string} tag - SVG 标签名 (如 'rect', 'circle', 'path')
 * @param {object} attrs - 自定义属性和样式 (可以传入 fill, stroke 等覆盖默认值)
 * @returns {SVGElement} - 创建好的 SVG 元素
 */
export function createShape(tag, attrs = {}) {
    const el = document.createElementNS(SVG_NS, tag);
    
    // 默认样式，子工具可以传入 attrs 覆盖这些默认值
    const shapeTags = ['rect', 'circle', 'ellipse', 'path', 'polygon', 'line'];
    let defaultAttrs = {};
    if (shapeTags.includes(tag)) {
        defaultAttrs = {
            "fill": "rgba(100, 149, 237, 0.3)",
            "stroke": "#6495ED",
            "stroke-width": "1"
        };
    }

    // 合并属性
    const finalAttrs = { ...defaultAttrs, ...attrs };

    // 设置属性
    for (const key in finalAttrs) {
        if (finalAttrs[key] !== null && finalAttrs[key] !== undefined) {
            el.setAttribute(key, finalAttrs[key]);
        }
    }

    return el;
}
