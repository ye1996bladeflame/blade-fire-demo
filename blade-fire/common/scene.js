import { SVG_NS, generateUID } from './element.js';

/** @typedef {{ tagName: string, attributes: Record<string, string>, textContent?: string, innerHTML?: string, hidden?: boolean }} ShapeRecord */
/** @typedef {{ order: string[], shapes: Map<string, ShapeRecord> }} SceneSnapshot */
/** @typedef {{ before: Map<string, ShapeRecord | null>, after: Map<string, ShapeRecord | null>, orderBefore?: string[], orderAfter?: string[] }} ScenePatch */

export function isContentNode(el) {
  if (!el || el.nodeType !== 1) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'defs' || tag === 'foreignobject') return false;
  if (el.id === 'grid-background') return false;
  if (el.getAttribute('data-is-grid') === 'true') return false;
  if (el.getAttribute('data-is-eraser') === 'true') return false;
  if (el.getAttribute('data-ephemeral') === 'true') return false;
  if (el.classList?.contains('grid-rect')) return false;
  if (el.classList?.contains('polygon-edit-handles')) return false;
  const uid = el.getAttribute('uid');
  if (!uid) return false;
  return true;
}

function findByUid(svg, uid) {
  for (const child of svg.children) {
    if (isContentNode(child) && child.getAttribute('uid') === uid) return child;
  }
  return null;
}

function serializeShape(el) {
  const attributes = {};
  for (let i = 0; i < el.attributes.length; i++) {
    const attr = el.attributes[i];
    attributes[attr.name] = attr.value;
  }
  /** @type {ShapeRecord} */
  const record = {
    tagName: el.tagName,
    attributes,
  };
  if (el.tagName === 'text') {
    record.textContent = el.textContent;
  } else if (el.innerHTML) {
    record.innerHTML = el.innerHTML;
  }
  if (el.style.display === 'none') {
    record.hidden = true;
  }
  return record;
}

function shapesEqual(a, b) {
  if (!a || !b) return false;
  if (a.tagName !== b.tagName) return false;
  if (a.textContent !== b.textContent) return false;
  if (a.innerHTML !== b.innerHTML) return false;
  if (!!a.hidden !== !!b.hidden) return false;
  const aKeys = Object.keys(a.attributes);
  const bKeys = Object.keys(b.attributes);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (a.attributes[key] !== b.attributes[key]) return false;
  }
  return true;
}

/**
 * 捕获场景快照。若传入 prev，未变更的 shape 记录复用同一引用（结构共享 / COW）。
 */
export function captureScene(svg, prev = null) {
  const order = [];
  const shapes = new Map();
  const seenUids = new Set();

  for (const child of svg.children) {
    if (!isContentNode(child)) continue;
    let uid = child.getAttribute('uid');
    if (seenUids.has(uid)) {
      uid = generateUID();
      child.setAttribute('uid', uid);
    }
    seenUids.add(uid);
    order.push(uid);
    const record = serializeShape(child);
    const prevRecord = prev?.shapes.get(uid);
    shapes.set(uid, prevRecord && shapesEqual(prevRecord, record) ? prevRecord : record);
  }

  const prevOrder = prev?.order;
  const sharedOrder = prevOrder && prevOrder.length === order.length && prevOrder.every((uid, i) => uid === order[i])
    ? prevOrder
    : order;

  return { order: sharedOrder, shapes };
}

/**
 * 对比两个快照，仅产出变更 uid 的局部 patch（命令携带的数据）。
 */
export function computePatch(prev, next) {
  /** @type {ScenePatch} */
  const patch = {
    before: new Map(),
    after: new Map(),
  };

  const allUids = new Set([...prev.shapes.keys(), ...next.shapes.keys()]);
  for (const uid of allUids) {
    const prevRecord = prev.shapes.get(uid) ?? null;
    const nextRecord = next.shapes.get(uid) ?? null;
    if (prevRecord === nextRecord) continue;
    if (prevRecord && nextRecord && shapesEqual(prevRecord, nextRecord)) continue;
    patch.before.set(uid, prevRecord);
    patch.after.set(uid, nextRecord);
  }

  if (prev.order !== next.order) {
    patch.orderBefore = prev.order;
    patch.orderAfter = next.order;
  }

  return patch;
}

export function isPatchEmpty(patch) {
  return patch.before.size === 0 && !patch.orderBefore;
}

function createElementFromRecord(record) {
  const el = document.createElementNS(SVG_NS, record.tagName);
  applyShapeRecord(el, record);
  return el;
}

function applyShapeRecord(el, record) {
  const nextAttrs = new Set(Object.keys(record.attributes));
  for (let i = el.attributes.length - 1; i >= 0; i--) {
    const name = el.attributes[i].name;
    if (!nextAttrs.has(name)) {
      el.removeAttribute(name);
    }
  }
  for (const [key, value] of Object.entries(record.attributes)) {
    el.setAttribute(key, value);
  }
  if (record.textContent !== undefined) {
    el.textContent = record.textContent;
  } else if (record.innerHTML !== undefined) {
    el.innerHTML = record.innerHTML;
  }
  el.style.display = record.hidden ? 'none' : '';
}

/**
 * 应用局部快照 patch，只增删改 patch 中涉及的 shape。
 */
export function applyPartial(svg, partial, order) {
  for (const [uid, record] of partial) {
    const existing = findByUid(svg, uid);
    if (record === null) {
      existing?.remove();
    } else if (existing) {
      applyShapeRecord(existing, record);
    } else {
      svg.appendChild(createElementFromRecord(record));
    }
  }

  if (order) {
    for (const uid of order) {
      const el = findByUid(svg, uid);
      if (el) svg.appendChild(el);
    }
  }
}

/** 清空或重置整个场景（仅 clear / bind 时使用） */
export function applyScene(svg, scene) {
  const existing = new Map();
  for (const child of svg.children) {
    if (!isContentNode(child)) continue;
    existing.set(child.getAttribute('uid'), child);
  }

  const targetUids = new Set(scene.order);

  for (const [uid, node] of existing) {
    if (!targetUids.has(uid)) {
      node.remove();
      existing.delete(uid);
    }
  }

  for (const uid of scene.order) {
    const record = scene.shapes.get(uid);
    if (!record) continue;

    let el = existing.get(uid);
    if (el) {
      applyShapeRecord(el, record);
    } else {
      el = createElementFromRecord(record);
      existing.set(uid, el);
    }
    svg.appendChild(el);
  }
}
