export class History {
  constructor() {
    this.undoStack = [];
    this.redoStack = [];
    this.id = Math.random();
    console.log("History created with ID:", this.id);
  }

  push(action) {
    this.undoStack.push(action);
    this.redoStack = [];
    console.log("History push on ID:", this.id, action);
  }

  undo() {
    if (this.undoStack.length === 0) return;
    const action = this.undoStack.pop();
    this.redoStack.push(action);
    if (action.undo) action.undo();
    console.log("Undo on ID:", this.id, action);
  }

  redo() {
    if (this.redoStack.length === 0) return;
    const action = this.redoStack.pop();
    this.undoStack.push(action);
    if (action.redo) action.redo();
    console.log("Redo on ID:", this.id, action);
  }
}

export const history = new History();
