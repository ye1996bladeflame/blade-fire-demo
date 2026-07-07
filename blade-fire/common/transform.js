export function parseTransform(transformStr) {
  const result = { tx: 0, ty: 0, rotate: 0, sx: 1, sy: 1 };
  if (!transformStr) return result;

  const mMatch = transformStr.match(/matrix\s*\(\s*([-\d.e]+)\s*[,\s]\s*([-\d.e]+)\s*[,\s]\s*([-\d.e]+)\s*[,\s]\s*([-\d.e]+)\s*[,\s]\s*([-\d.e]+)\s*[,\s]\s*([-\d.e]+)\s*\)/);
  if (mMatch) {
    const a = parseFloat(mMatch[1]);
    const b = parseFloat(mMatch[2]);
    const c = parseFloat(mMatch[3]);
    const d = parseFloat(mMatch[4]);
    const e = parseFloat(mMatch[5]);
    const f = parseFloat(mMatch[6]);

    result.tx = e;
    result.ty = f;
    result.sx = Math.sqrt(a * a + b * b);
    result.sy = Math.sqrt(c * c + d * d);

    const det = a * d - b * c;
    if (det < 0) result.sy = -result.sy;

    const rotRad = Math.atan2(b, Math.abs(a) > 1e-6 ? a : (a >= 0 ? 1e-6 : -1e-6));
    result.rotate = rotRad * 180 / Math.PI;
    return result;
  }

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
