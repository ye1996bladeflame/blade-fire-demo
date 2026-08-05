import { history } from './history.js';
import { parsePathData, isClosedPolygonPath } from './path-utils.js';
import { createShape, getToolStyle } from './element.js';

/**
 * 统一的撤销/重做管理器，按图形类型注册处理器。
 *
 * 内置能力：
 * - 多边形"创建多边形"命令的逐点撤销/重做（不依赖 polygon 工具激活状态）
 * - 按 history command 的 shapeType 自动分发到对应 handler
 */
class UndoRedoManager {
  constructor() {
    /** @type {Map<string, TypeHandler>} */
    this._handlers = new Map();
    this._onSelectionChange = null;
    this._onToolChange = null;
    /** 多边形逐点重做状态：uid -> { poppedPoints: Point[] } */
    this._polygonRedoState = new Map();
    /** LIFO 重做顺序：记录 uid 的撤销先后顺序，最后撤销的最先重做 */
    this._polygonRedoOrder = [];
  }

  /**
   * 注册类型处理器
   * @param {string} shapeType
   * @param {TypeHandler} handler
   */
  register(shapeType, handler) {
    this._handlers.set(shapeType, handler);
    return () => this._handlers.delete(shapeType);
  }

  setSelectionCallback(callback) { this._onSelectionChange = callback; }
  setToolChangeCallback(callback) { this._onToolChange = callback; }

  // ---- 多边形逐点撤销 ----

  /**
   * 存储一个待重做的顶点并维护 LIFO 顺序。
   * 供 _polygonPointUndo 和 polygon 工具的绘制模式撤销使用。
   */
  pushPolygonRedoPoint(uid, point) {
    let state = this._polygonRedoState.get(uid);
    if (!state) {
      state = { poppedPoints: [] };
      this._polygonRedoState.set(uid, state);
    }
    state.poppedPoints.push(point);
    // 将 uid 移到顺序末尾（最后撤销的最先重做）
    const idx = this._polygonRedoOrder.indexOf(uid);
    if (idx !== -1) this._polygonRedoOrder.splice(idx, 1);
    this._polygonRedoOrder.push(uid);
  }

  /**
   * 清除某个多边形的 redo 状态（用户在手动画新点时调用，路径已分叉）。
   */
  clearPolygonRedoState(uid) {
    this._polygonRedoState.delete(uid);
    const idx = this._polygonRedoOrder.indexOf(uid);
    if (idx !== -1) this._polygonRedoOrder.splice(idx, 1);
  }

  /**
   * 对"创建多边形"命令做逐点撤销：弹出 path 最后一个顶点。
   * @param {SVGSVGElement} svg
   * @param {string} [targetUid] 可选，仅当顶部命令匹配此 uid 时才撤销
   * @returns {{ uid: string, remainingPoints: object[] } | null}
   */
  _polygonPointUndo(svg, targetUid) {
    const cmd = history.undoStack[history.undoStack.length - 1];
    if (!cmd || cmd.desc !== '创建多边形' || cmd.shapeType !== 'polygon') return null;

    const uid = cmd.relatedUids?.[0];
    if (!uid) return null;

    // 如果指定了 targetUid，仅处理匹配的命令（避免编辑多边形 A 时误撤销多边形 B 的顶点）
    if (targetUid && uid !== targetUid) return null;

    const path = svg?.querySelector(`[uid="${uid}"]`);
    if (!path) return null;

    const vertexPoints = parsePathData(path.getAttribute('d'));
    if (vertexPoints.length < 3) return null; // 回退给 history.undo() 整图删除

    const popped = vertexPoints.pop();
    const newD = vertexPoints.map((p, i) => (i === 0 ? 'M' : 'L') + ` ${p.x} ${p.y}`).join(' ');
    path.setAttribute('d', newD);
    path.setAttribute('fill', 'none');
    path.removeAttribute('data-polygon-editing');

    // 清理残留编辑手柄
    svg.querySelectorAll('g.polygon-edit-handles').forEach(el => el.remove());

    // 存储 redo 状态（LIFO）
    this.pushPolygonRedoPoint(uid, popped);

    // 从 undoStack 移除该 commit
    for (let i = history.undoStack.length - 1; i >= 0; i--) {
      if (history.undoStack[i] === cmd) { history.undoStack.splice(i, 1); break; }
    }

    history.syncBaseline();
    history.notify();
    return { uid, remainingPoints: vertexPoints };
  }

  // ---- 多边形逐点重做 ----

  /**
   * 逐点恢复上次撤销的顶点。所有点恢复后自动闭合并重新 commit。
   * @returns {{ uid: string, newPoints: object[], closed: boolean } | null}
   */
  _polygonPointRedo(svg) {
    // LIFO 迭代：从 _polygonRedoOrder 尾部开始（最后撤销的最先重做）
    while (this._polygonRedoOrder.length > 0) {
      const uid = this._polygonRedoOrder[this._polygonRedoOrder.length - 1];
      const state = this._polygonRedoState.get(uid);
      if (!state || state.poppedPoints.length === 0) {
        this._polygonRedoOrder.pop();
        this._polygonRedoState.delete(uid);
        continue;
      }

      let path = svg.querySelector(`[uid="${uid}"]`);
      if (!path) {
        path = createShape('path', {
          ...getToolStyle('polygon'),
          uid: uid,
          fill: 'none',
          d: '',
          'stroke-linejoin': 'round',
          'stroke-linecap': 'round',
        });
        svg.appendChild(path);
      }

      const popped = state.poppedPoints.pop();
      const currentPoints = parsePathData(path.getAttribute('d') || '');
      currentPoints.push(popped);

      const newD = currentPoints.map((p, i) => (i === 0 ? 'M' : 'L') + ` ${p.x} ${p.y}`).join(' ');
      const closed = state.poppedPoints.length === 0;

      if (closed) {
        path.setAttribute('d', newD + ' Z');
        path.setAttribute('fill', 'transparent');
        path.setAttribute('data-polygon-editing', 'true');
        history.commit('创建多边形', { shapeType: 'polygon', relatedUids: [uid] });
        this._polygonRedoOrder.pop();
        this._polygonRedoState.delete(uid);
      } else {
        path.setAttribute('d', newD);
        path.setAttribute('fill', 'none');
        history.syncBaseline();
      }

      history.notify();
      return { uid, newPoints: currentPoints, closed };
    }
    return null;
  }

  /**
   * 检查是否有待处理的多边形逐点重做（供 polygon 工具 onKeyDown 查询）。
   */
  hasPendingPolygonRedo() {
    for (const state of this._polygonRedoState.values()) {
      if (state.poppedPoints.length > 0) return true;
    }
    return false;
  }

  // ---- 公共接口 ----

  /**
   * 执行撤销。
   * @param {SVGSVGElement} svg
   * @param {string} [targetUid] 可选，仅处理匹配该 uid 的多边形命令
   * @returns {object | true | undefined}
   *   - { type: 'polygon-undo', uid, remainingPoints } — 多边形逐点撤销
   *   - true — handler 或 history.undo() 已处理
   *   - undefined — 无操作
   */
  undo(svg, targetUid) {
    // 优先：多边形逐点撤销
    const polyResult = this._polygonPointUndo(svg, targetUid);
    if (polyResult) return { type: 'polygon-undo', ...polyResult };

    const cmd = history.undoStack[history.undoStack.length - 1];
    if (!cmd) return;

    const handler = this._handlers.get(cmd.shapeType);
    if (handler?.onBeforeUndo?.(cmd, svg) === true) return true;

    history.undo();
    return true;
  }

  /**
   * 执行重做。
   * @returns {object | true | undefined}
   *   - { type: 'polygon-redo', uid, newPoints, closed } — 多边形逐点重做
   *   - true — handler 或 history.redo() 已处理
   *   - undefined — 无操作
   */
  redo(svg) {
    // 优先：多边形逐点重做
    const polyResult = this._polygonPointRedo(svg);
    if (polyResult) return { type: 'polygon-redo', ...polyResult };

    // handler 待处理重做（cmd 为 null，不依赖 redoStack）
    for (const handler of this._handlers.values()) {
      if (handler.onBeforeRedo?.(null, svg) === true) return true;
    }

    const cmd = history.redoStack[history.redoStack.length - 1];
    if (!cmd) return;

    const handler = this._handlers.get(cmd.shapeType);
    if (handler?.onBeforeRedo?.(cmd, svg) === true) return true;

    history.redo();
    return true;
  }

  /**
   * 撤销/重做后的统一恢复入口。
   * - 多边形：自动清理编辑手柄，重建编辑状态
   * - 其他类型：委托给 handler.onRestore
   */
  onRestore(cmd, svg) {
    if (!cmd) return;

    // 多边形通用恢复：清理编辑手柄，设置 data-polygon-editing
    if (cmd.shapeType === 'polygon') {
      svg.querySelectorAll('g.polygon-edit-handles').forEach(el => el.remove());
      const uid = cmd.relatedUids?.[0];
      if (uid) {
        const el = svg.querySelector(`[uid="${uid}"]`);
        if (el && isClosedPolygonPath(el)) {
          svg.querySelectorAll('[data-polygon-editing="true"]').forEach(e => e.removeAttribute('data-polygon-editing'));
          el.setAttribute('data-polygon-editing', 'true');
        }
      }
    }

    const handler = this._handlers.get(cmd.shapeType);
    if (handler?.onRestore) {
      handler.onRestore(cmd, svg);
    }

    if (!handler && cmd.shapeType !== 'polygon') {
      this._cleanStaleEditState(svg);
    }

    // 恢复选中状态
    if (this._onSelectionChange && cmd.relatedUids?.length) {
      const el = this._findDomElement(cmd.relatedUids, svg);
      if (el) {
        const bounds = this._getElementBounds(el);
        if (bounds) {
          this._onSelectionChange([{
            id: el.id,
            tagName: el.tagName,
            x: bounds.x, y: bounds.y,
            width: bounds.width, height: bounds.height,
            rotation: this._getRotation(el),
          }]);
          if (this._onToolChange && el.tagName !== 'g') {
            this._onToolChange(cmd.shapeType, el.tagName);
          }
          return;
        }
      }
      this._onSelectionChange([]);
    }
  }

  // ---- 内部辅助 ----

  _cleanStaleEditState(svg) {
    if (!svg) return;
    svg.querySelectorAll('[data-polygon-editing="true"]').forEach(el => {
      el.removeAttribute('data-polygon-editing');
    });
    svg.querySelectorAll('g.polygon-edit-handles, g[class*="polygon-edit-handles"]').forEach(el => el.remove());
  }

  _findDomElement(uids, svg) {
    if (!uids || !svg) return null;
    for (const uid of uids) {
      const el = svg.querySelector(`[uid="${uid}"]`);
      if (el && el.isConnected) return el;
    }
    return null;
  }

  _getElementBounds(el) {
    try {
      const bbox = el.getBBox();
      let matrix = el.ownerSVGElement?.createSVGMatrix?.();
      if (!matrix) return { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height };
      if (el.transform?.baseVal?.numberOfItems > 0) {
        for (let i = 0; i < el.transform.baseVal.numberOfItems; i++) {
          matrix = matrix.multiply(el.transform.baseVal.getItem(i).matrix);
        }
      }
      const pts = [
        new DOMPoint(bbox.x, bbox.y),
        new DOMPoint(bbox.x + bbox.width, bbox.y),
        new DOMPoint(bbox.x + bbox.width, bbox.y + bbox.height),
        new DOMPoint(bbox.x, bbox.y + bbox.height),
      ];
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      pts.forEach((pt) => {
        const t = pt.matrixTransform(matrix);
        minX = Math.min(minX, t.x); minY = Math.min(minY, t.y);
        maxX = Math.max(maxX, t.x); maxY = Math.max(maxY, t.y);
      });
      return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    } catch {
      return null;
    }
  }

  _getRotation(el) {
    const t = el.getAttribute('transform') || '';
    const m = t.match(/rotate\(([^)]+)\)/);
    return m ? parseFloat(m[1]) : 0;
  }
}

/** @typedef {{ onBeforeUndo?: (cmd: any, svg: any) => boolean, onBeforeRedo?: (cmd: any, svg: any) => boolean, onRestore?: (cmd: any, svg: any) => void }} TypeHandler */

export const undoRedoManager = new UndoRedoManager();
