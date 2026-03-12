import { setCursor } from "../common/index.js";

export function triangle(svg) {
    console.log("Triangle tool activated");
    if (svg) {
        setCursor(svg, "crosshair");
    }
    
    return () => {
        console.log("Triangle tool deactivated");
    };
}