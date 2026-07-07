import { captureScene, applyScene, applyPartial, computePatch, isPatchEmpty } from './scene.js';

/**
 * @typedef {Object} HistoryCommand
 * @property {string} desc
 * @property {Map<string, import('./scene.js').ShapeRecord | null>} before - 局部快照：操作前
 * @property {Map<string, import('./scene.js').ShapeRecord | null>} after - 局部快照：操作后
 * @property {string[] | undefined} orderBefore
 * @property {string[] | undefined} orderAfter
 */

export class History {
  constructor() {
    this.undoStack = [];
    this.redoStack = [];
    /** @type {import('./scene.js').SceneSnapshot | null} */
    this.baseline = null;
    this.svg = null;
    this.listeners = [];
    this.restoreListeners = [];
    /** @type {number} 防抖截止时间戳，替代 setTimeout 避免定时器堆积 */
    this.lockUntil = 0;
    this.lockMs = 50;
  }

  _isLocked() {
    return performance.now() < this.lockUntil;
  }

  _acquireLock() {
    this.lockUntil = performance.now() + this.lockMs;
  }

  _releaseLock() {
    this.lockUntil = 0;
  }

  bind(svg) {
    this.svg = svg;
    this.baseline = captureScene(svg);
    this.undoStack = [];
    this.redoStack = [];
    this._releaseLock();
    this.notify();
  }

  subscribe(callback) {
    this.listeners.push(callback);
    callback(this.undoStack);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  onRestore(callback) {
    this.restoreListeners.push(callback);
    return () => {
      this.restoreListeners = this.restoreListeners.filter((l) => l !== callback);
    };
  }

  notify() {
    this.listeners.forEach((l) => l(this.undoStack));
  }

  notifyRestore() {
    this.restoreListeners.forEach((l) => l());
  }

  /** @returns {HistoryCommand} */
  _createCommand(desc, patch) {
    return {
      desc,
      before: patch.before,
      after: patch.after,
      orderBefore: patch.orderBefore,
      orderAfter: patch.orderAfter,
    };
  }

  /** @param {HistoryCommand} cmd */
  _applyUndo(cmd) {
    applyPartial(this.svg, cmd.before, cmd.orderBefore);
    this.baseline = captureScene(this.svg, this.baseline);
  }

  /** @param {HistoryCommand} cmd */
  _applyRedo(cmd) {
    applyPartial(this.svg, cmd.after, cmd.orderAfter);
    this.baseline = captureScene(this.svg, this.baseline);
  }

  /**
   * 提交一条命令：自动 diff 当前 DOM 与 baseline，仅存储变更部分的局部快照。
   */
  commit(desc) {
    if (!this.svg) {
      console.warn('History: svg not bound, call history.bind(svg) first');
      return;
    }
    const next = captureScene(this.svg, this.baseline);
    const patch = computePatch(this.baseline, next);
    if (isPatchEmpty(patch)) return;

    this.undoStack.push(this._createCommand(desc, patch));
    this.redoStack = [];
    this.baseline = next;
    this.notify();
  }

  /**
   * 手动推送命令（可选）：直接提供局部 before/after 快照。
   * redo 需已应用到 DOM，push 只负责入栈。
   */
  push(action) {
    if (!this.svg) return;

    if (action.before && action.after) {
      const patch = {
        before: action.before,
        after: action.after,
        orderBefore: action.orderBefore,
        orderAfter: action.orderAfter,
      };
      if (isPatchEmpty(patch) && !action.force) return;
      this.undoStack.push(this._createCommand(action.desc || '操作', patch));
      this.redoStack = [];
      this.baseline = captureScene(this.svg, this.baseline);
      this.notify();
      return;
    }

    if (action.redo) action.redo();
    this.commit(action.desc || '操作');
  }

  undo() {
    if (this._isLocked() || !this.svg || this.undoStack.length === 0) return;
    this._acquireLock();

    const cmd = this.undoStack.pop();
    this.redoStack.push(cmd);
    this._applyUndo(cmd);
    this.notifyRestore();
    this.notify();
  }

  redo() {
    if (this._isLocked() || !this.svg || this.redoStack.length === 0) return;
    this._acquireLock();

    const cmd = this.redoStack.pop();
    this.undoStack.push(cmd);
    this._applyRedo(cmd);
    this.notifyRestore();
    this.notify();
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this._releaseLock();
    if (this.svg?.isConnected) {
      const empty = { order: [], shapes: new Map() };
      applyScene(this.svg, empty);
      this.baseline = empty;
      this.notifyRestore();
    } else {
      this.baseline = null;
    }
    this.notify();
  }
}

export const history = new History();
