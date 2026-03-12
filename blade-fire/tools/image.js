import { setCursor } from "../common/index.js";

export function image(svg) {
    console.log("Image tool activated");
    if (svg) {
        setCursor(svg, "crosshair");
    }
    
    return () => {
        console.log("Image tool deactivated");
    };
}