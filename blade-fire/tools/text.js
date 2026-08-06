import { setCursor, history, createShape, getToolStyle, createListenerManager } from "../common/index.js";
import { clampPoint } from "../common/draw-area.js";

let svgElement = null;
let currentInput = null;
const listeners = createListenerManager();

function getMousePosition(evt) {
    if (!svgElement) return { x: 0, y: 0 };
    const CTM = svgElement.getScreenCTM();
    if (!CTM) return { x: 0, y: 0 };
    // 文本位置限制在绘制区域内
    return clampPoint(svgElement, (evt.clientX - CTM.e) / CTM.a, (evt.clientY - CTM.f) / CTM.d);
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

        if (newValue.trim() !== "") {
            textNode.textContent = newValue;
            textNode.style.visibility = "visible";
            if (isNewText) {
                history.commit('创建文本', { shapeType: 'text', relatedUids: [textNode.getAttribute('uid')] });
            } else if (newValue !== initialContent) {
                history.commit('编辑文本', { shapeType: 'text', relatedUids: [textNode.getAttribute('uid')] });
            }
        } else {
            textNode.remove();
            if (!isNewText) {
                history.commit('删除文本', { shapeType: 'text', relatedUids: [textNode.getAttribute('uid')] });
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
        "style": "white-space: pre; font-family: Arial; font-size: 28px;",
        "transform": `translate(${pos.x}, ${pos.y})`,
        ...getToolStyle("text")
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

    listeners.activate();
    listeners.on(svgElement, "mousedown", onMouseDown);

    return () => {
        listeners.dispose();
        if (currentInput) {
            currentInput.blur();
        }
        console.log("Text tool deactivated");
    };
}
