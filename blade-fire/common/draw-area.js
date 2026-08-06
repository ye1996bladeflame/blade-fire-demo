/**
 * 绘制区域约束工具。
 *
 * 在 SVG 中声明绘制区域：给元素添加 draw-area="true" 属性（如一张图片），
 * 即可用本模块把坐标点 / 图形 / 移动 / 缩放限制在该区域内。
 * 新增工具时按需 import 对应方法即可，无需关心区域是如何查找的。
 *
 * 用法示例：
 *   import { clampPoint, clampMove } from '../common/draw-area.js';
 *
 *   // 绘制/定位时：把鼠标坐标钳制在区域内
 *   const pos = clampPoint(svg, mouseX, mouseY);
 *
 *   // 移动时：bounds 为图形移动前的全局边界，返回不会让图形移出区域的平移量
 *   const { dx, dy } = clampMove(svg, bounds, offsetX, offsetY);
 */

/**
 * 获取绘制区域边界（带 draw-area="true" 属性的元素）。
 * 未配置绘制区域时返回 null，调用方应视为"不限制"。
 * @param {SVGSVGElement} svg
 * @returns {{el: Element, x: number, y: number, width: number, height: number} | null}
 */
export function getDrawingArea(svg) {
    if (!svg) return null;
    const el = svg.querySelector('[draw-area="true"]');
    if (!el) return null;
    let x = parseFloat(el.getAttribute('x') || 0);
    let y = parseFloat(el.getAttribute('y') || 0);
    let width = parseFloat(el.getAttribute('width') || 0);
    let height = parseFloat(el.getAttribute('height') || 0);
    if (!width || !height) {
        try {
            const bbox = el.getBBox();
            x = bbox.x;
            y = bbox.y;
            width = bbox.width;
            height = bbox.height;
        } catch {
            return null;
        }
    }
    if (width <= 0 || height <= 0) return null;
    return { el, x, y, width, height };
}

/**
 * 将坐标点限制在绘制区域内（未配置绘制区域时原样返回）。
 * @param {SVGSVGElement} svg
 * @param {number} x
 * @param {number} y
 * @returns {{x: number, y: number}}
 */
export function clampPoint(svg, x, y) {
    const area = getDrawingArea(svg);
    if (!area) return { x, y };
    return {
        x: Math.min(Math.max(x, area.x), area.x + area.width),
        y: Math.min(Math.max(y, area.y), area.y + area.height),
    };
}

/**
 * 将矩形边界限制在绘制区域内：先收缩到区域大小，再钳制位置。
 * @param {SVGSVGElement} svg
 * @param {{x: number, y: number, width: number, height: number}} rect
 * @returns {{x: number, y: number, width: number, height: number}}
 */
export function clampRect(svg, rect) {
    const area = getDrawingArea(svg);
    if (!area) return rect;
    const width = Math.min(rect.width, area.width);
    const height = Math.min(rect.height, area.height);
    return {
        x: Math.min(Math.max(rect.x, area.x), area.x + area.width - width),
        y: Math.min(Math.max(rect.y, area.y), area.y + area.height - height),
        width,
        height,
    };
}

/**
 * 钳制平移量，使图形（移动前边界 bounds）移动后仍完整位于绘制区域内。
 * 无绘制区域时原样返回。
 * @param {SVGSVGElement} svg
 * @param {{x: number, y: number, width: number, height: number}} bounds 图形移动前的全局边界
 * @param {number} dx 期望的 X 平移量
 * @param {number} dy 期望的 Y 平移量
 * @returns {{dx: number, dy: number}}
 */
export function clampMove(svg, bounds, dx, dy) {
    const area = getDrawingArea(svg);
    if (!area) return { dx, dy };
    const minDx = area.x - bounds.x;
    const maxDx = area.x + area.width - (bounds.x + bounds.width);
    const minDy = area.y - bounds.y;
    const maxDy = area.y + area.height - (bounds.y + bounds.height);
    return {
        dx: Math.min(Math.max(dx, minDx), maxDx),
        dy: Math.min(Math.max(dy, minDy), maxDy),
    };
}
