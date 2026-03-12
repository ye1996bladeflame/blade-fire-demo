import { setCursor } from "../common/index.js";

export function line(svg) {
    console.log("Line tool activated");
    if (svg) {
        setCursor(svg, "crosshair");
    }
    
    return () => {
        console.log("Line tool deactivated");
    };
}