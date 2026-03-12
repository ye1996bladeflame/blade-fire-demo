import { setCursor } from "../common/index.js";

export function polygon(svg) {
    console.log("Polygon tool activated");
    if (svg) {
        setCursor(svg, "crosshair");
    }
    
    return () => {
        console.log("Polygon tool deactivated");
    };
}