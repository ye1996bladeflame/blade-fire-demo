/**
 * 解析 SVG path 的 d 属性，提取顶点坐标。
 * 仅处理 M/m、L/l 命令，跳过 H/h、V/v 等。
 */
export function parsePathData(d) {
    if (!d) return [];
    const points = [];
    const commands = d.match(/[MmLlHhVv][^MmLlHhVv]*/g) || [];
    let currentPos = { x: 0, y: 0 };
    commands.forEach((cmdStr) => {
        const type = cmdStr[0];
        const args = cmdStr.slice(1).trim().split(/[\s,]+/).map(parseFloat).filter((n) => !isNaN(n));
        if (type === "M" || type === "L") {
            for (let i = 0; i < args.length; i += 2) {
                currentPos = { x: args[i], y: args[i + 1] };
                points.push(currentPos);
            }
        } else if (type === "m" || type === "l") {
            for (let i = 0; i < args.length; i += 2) {
                currentPos.x += args[i];
                currentPos.y += args[i + 1];
                points.push({ ...currentPos });
            }
        }
    });
    const finalPoints = [];
    const uniquePoints = new Set();
    for (const p of points) {
        const key = `${p.x},${p.y}`;
        if (!uniquePoints.has(key)) {
            uniquePoints.add(key);
            finalPoints.push(p);
        }
    }
    // 去掉闭合路径末尾重复的起点
    if (finalPoints.length > 2) {
        const first = finalPoints[0];
        const last = finalPoints[finalPoints.length - 1];
        if (first.x === last.x && first.y === last.y) {
            finalPoints.pop();
        }
    }
    return finalPoints;
}

/**
 * 从顶点数组构建闭合路径的 d 属性。
 */
export function buildPathData(points) {
    if (!points || points.length === 0) return "";
    const d = points.map((p, i) => (i === 0 ? "M" : "L") + ` ${p.x} ${p.y}`).join(" ");
    return d + " Z";
}

/**
 * 检查 path 元素是否为闭合多边形路径。
 */
export function isClosedPolygonPath(el) {
    if (!el || el.tagName !== "path") return false;
    const d = el.getAttribute("d");
    return d && /Z\s*$/i.test(d.trim());
}
