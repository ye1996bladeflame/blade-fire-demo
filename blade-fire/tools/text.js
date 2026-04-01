import { setCursor, history, createShape } from "../common/index.js";

let svgElement = null;
let currentInput = null;

function getMousePosition(evt) {
    if (!svgElement) return { x: 0, y: 0 };
    const CTM = svgElement.getScreenCTM();
    if (!CTM) return { x: 0, y: 0 };
    return {
        x: (evt.clientX - CTM.e) / CTM.a,
        y: (evt.clientY - CTM.f) / CTM.d
    };
}

function startEditing(textNode, isNew = false) {
    
    if (currentInput) {
        currentInput.blur();
    }

    const initialContent = textNode.textContent;
    const isNewText = isNew;

    const textContent = textNode.textContent;
    const rect = textNode.getBoundingClientRect();
    
    
    const input = document.createElement("input");
    input.type = "text";
    input.value = textContent;
    
    
    const style = window.getComputedStyle(textNode);
    input.style.position = "absolute";
    input.style.left = (rect.left + window.scrollX) + "px";
    
    
    input.style.top = (rect.top + window.scrollY) + "px";
    
    input.style.fontFamily = style.fontFamily;
    input.style.fontSize = style.fontSize;
    input.style.color = style.fill;
    input.style.background = "transparent";
    input.style.border = "1px dashed #999";
    input.style.outline = "none";
    input.style.padding = "0";
    input.style.margin = "0";
    input.style.minWidth = Math.max(rect.width + 20, 100) + "px";
    input.style.zIndex = "1000";

    document.body.appendChild(input);
    input.focus();
    input.select();

    currentInput = input;

    
    
    
    textNode.style.visibility = "hidden";

    const finishEditing = () => {
        
        if (!currentInput) return;
        
        const newValue = input.value;
        const textNodeRef = textNode; 
        
        if (newValue.trim() !== "") {
            textNode.textContent = newValue;
            textNode.style.visibility = "visible";
            
            if (isNewText) {
                
                history.push({
                    desc: '创建文本',
                    undo: () => textNodeRef.remove(),
                    redo: () => svgElement.appendChild(textNodeRef)
                });
            } else if (newValue !== initialContent) {
                
                const oldContent = initialContent;
                const newContent = newValue;
                history.push({
                    desc: '编辑文本',
                    undo: () => { textNodeRef.textContent = oldContent; },
                    redo: () => { textNodeRef.textContent = newContent; }
                });
            }
        } else {
            
            textNode.remove();
            
            if (!isNewText) {
                 
                 const oldContent = initialContent;
                 
                 
                 
                 history.push({
                     desc: '删除文本',
                     undo: () => { 
                         textNodeRef.textContent = oldContent;
                         textNodeRef.style.visibility = "visible";
                         svgElement.appendChild(textNodeRef);
                     },
                     redo: () => textNodeRef.remove()
                 });
            }
        }
        
        input.remove();
        currentInput = null;
    };

    input.addEventListener("blur", finishEditing);
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            input.blur(); 
        }
        if (e.key === "Escape") {
            
            textNode.style.visibility = "visible";
            input.remove();
            currentInput = null;
        }
    });
}

function onMouseDown(evt) {
    
    if (evt.button !== 0) return;
    
    
    
    
    if (currentInput) {
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        if (evt.target.tagName === "text") {
             
             
             
             
        } else {
             
             
             return;
        }
    }
    
    
    if (evt.target.tagName === "text") {
        evt.stopPropagation();
        startEditing(evt.target);
        return;
    }

    const pos = getMousePosition(evt);
    
    const textNode = createShape("text", {
        "style": "white-space: pre; fill: rgb(51, 51, 51); font-family: Arial; font-size: 28px;",
        "transform": `translate(${pos.x}, ${pos.y})`
    });
    
    textNode.textContent = "Text";
    
    svgElement.appendChild(textNode);
    console.log("Text added at", pos.x, pos.y);
    
    
    
    setTimeout(() => {
        startEditing(textNode, true);
    }, 0);
}

export function text(svg) {
    console.log("Text tool activated");
    
    svgElement = svg;
    if (!svgElement) {
        console.error("BladeFire SVG not initialized");
        return;
    }

    setCursor(svgElement, "text");

    
    svgElement.removeEventListener("mousedown", onMouseDown);
    
    
    svgElement.addEventListener("mousedown", onMouseDown);
    
    return () => {
        svgElement.removeEventListener("mousedown", onMouseDown);
        if (currentInput) {
            currentInput.blur(); 
        }
        console.log("Text tool deactivated");
    };
}
