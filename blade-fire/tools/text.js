import { setCursor } from "../common/index.js";

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

function startEditing(textNode) {
    // If already editing, finish that first
    if (currentInput) {
        currentInput.blur();
    }

    const textContent = textNode.textContent;
    const rect = textNode.getBoundingClientRect();
    
    // Create input element
    const input = document.createElement("input");
    input.type = "text";
    input.value = textContent;
    
    // Style the input to match the text node visually
    const style = window.getComputedStyle(textNode);
    input.style.position = "absolute";
    input.style.left = (rect.left + window.scrollX) + "px";
    // Adjust top slightly to align baseline better, though exact match is hard
    // rect.top is the bounding box top, which includes ascenders
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

    // Temporarily hide the text node (optional, but avoids double vision)
    // Actually better to keep it visible but maybe dimmed, or just overlay?
    // Let's keep it visible so user sees context, input background is transparent.
    textNode.style.visibility = "hidden";

    const finishEditing = () => {
        // If input is already removed or null, return
        if (!currentInput) return;
        
        const newValue = input.value;
        if (newValue.trim() !== "") {
            textNode.textContent = newValue;
            textNode.style.visibility = "visible";
        } else {
            // Remove empty text node
            textNode.remove();
        }
        
        input.remove();
        currentInput = null;
    };

    input.addEventListener("blur", finishEditing);
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            input.blur(); // Will trigger finishEditing
        }
        if (e.key === "Escape") {
            // Cancel editing
            textNode.style.visibility = "visible";
            input.remove();
            currentInput = null;
        }
    });
}

function onMouseDown(evt) {
    // Only allow left mouse button
    if (evt.button !== 0) return;
    
    // If we are currently editing, clicking anywhere should just close the editor
    // The blur event on the input will handle closing.
    // We should NOT create new text if we were editing.
    if (currentInput) {
        // We rely on the blur event to close the input.
        // But we must prevent the code below from running.
        // Also, if we clicked on ANOTHER text, we might want to start editing that one?
        // The blur event fires BEFORE mousedown? Or after?
        // Typically mousedown -> blur -> click.
        // If we just return here, the blur handler runs, closes input.
        // And we don't create new text. This matches user request.
        
        // If the user clicked on another text, we might want to edit that one.
        // But the blur handler sets currentInput to null.
        // So if blur happens before this mousedown handler, currentInput is already null.
        // If blur happens after, then currentInput is not null.
        
        // Let's test assumption: mousedown on SVG triggers blur on input?
        // Yes, clicking outside input blurs it.
        // The order is: Mousedown (SVG) -> Blur (Input) ? No.
        // Mousedown on new target -> Blur on old target -> Focus on new target -> Mouseup -> Click.
        // Wait, mousedown on SVG happens. SVG is not focusable by default.
        // If I click on SVG, the input loses focus.
        
        // If I return here, I rely on the blur event to finish editing.
        // And I prevent creating new text.
        // But if I clicked on an EXISTING text, I want to edit it.
        // So I should check target.
        
        if (evt.target.tagName === "text") {
             // Let the specific text handler below handle it
             // But we need to make sure the previous input is closed.
             // startEditing calls currentInput.blur() first thing.
             // So we can proceed to logic below.
        } else {
             // Clicked on empty space (or non-text).
             // Just return. The blur event will handle closing the input.
             return;
        }
    }
    
    // Check if clicked on existing text
    if (evt.target.tagName === "text") {
        evt.stopPropagation();
        startEditing(evt.target);
        return;
    }

    const pos = getMousePosition(evt);
    
    // Create text element directly without prompt
    const svgNS = "http://www.w3.org/2000/svg";
    const textNode = document.createElementNS(svgNS, "text");
    
    // Set style as requested
    textNode.setAttribute("style", "white-space: pre; fill: rgb(51, 51, 51); font-family: Arial; font-size: 28px;");
    
    // Use translate for positioning to be compatible with select tool's transform parsing
    // matrix(1, 0, 0, 1, x, y) is equivalent to translate(x, y)
    // But select.js parses translate(tx, ty) better.
    textNode.setAttribute("transform", `translate(${pos.x}, ${pos.y})`);
    
    // Set default content
    textNode.textContent = "Text";
    
    svgElement.appendChild(textNode);
    console.log("Text added at", pos.x, pos.y);
    
    // Start editing immediately
    // Use setTimeout to ensure the element is rendered and has dimensions
    setTimeout(() => {
        startEditing(textNode);
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

    // Remove existing listener to avoid duplication
    svgElement.removeEventListener("mousedown", onMouseDown);
    
    // Add listener
    svgElement.addEventListener("mousedown", onMouseDown);
    
    return () => {
        svgElement.removeEventListener("mousedown", onMouseDown);
        if (currentInput) {
            currentInput.blur(); // Commit changes if tool is switched
        }
        console.log("Text tool deactivated");
    };
}
