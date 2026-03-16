export class History {
  constructor() {
    this.undoStack = [];
    this.redoStack = [];
    this.listeners = [];
    this.id = Math.random();
    console.log("History created with ID:", this.id);
  }

  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  notify() {
    this.listeners.forEach(l => l(this.undoStack));
  }

  push(action) {
    this.undoStack.push(action);
    this.redoStack = [];
    console.log("History push on ID:", this.id, action);
    this.notify();
  }

  undo() {
    if (this.undoStack.length === 0) return;
    const action = this.undoStack.pop();
    this.redoStack.push(action);
    if (action.undo) action.undo();
    console.log("Undo on ID:", this.id, action);
    this.notify();
  }

  redo() {
    if (this.redoStack.length === 0) return;
    const action = this.redoStack.pop();
    this.undoStack.push(action);
    if (action.redo) action.redo();
    console.log("Redo on ID:", this.id, action);
    this.notify();
  }
}

export const history = new History();
