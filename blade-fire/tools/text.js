import { setCursor } from "../common/index.js";

export function text(svg) {
    console.log("Text tool activated");
    if (svg) {
        setCursor(svg, "text");
    }
    
    return () => {
        console.log("Text tool deactivated");
    };
}