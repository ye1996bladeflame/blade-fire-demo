import { setCursor } from "../common/index.js";

export function circle(svg) {
    console.log("Circle tool activated");
    if (svg) {
        setCursor(svg, "crosshair");
    }
    
    return () => {
        console.log("Circle tool deactivated");
    };
}