export class History {
  constructor() {
    this.undoStack = [];
    this.redoStack = [];
  }

  push(action) {
    this.undoStack.push(action);
    this.redoStack = [];
    console.log("History push", action);
  }

  undo() {
    if (this.undoStack.length === 0) return;
    const action = this.undoStack.pop();
    this.redoStack.push(action);
    if (action.undo) action.undo();
    console.log("Undo", action);
  }

  redo() {
    if (this.redoStack.length === 0) return;
    const action = this.redoStack.pop();
    this.undoStack.push(action);
    if (action.redo) action.redo();
    console.log("Redo", action);
  }
}

export const history = new History();
