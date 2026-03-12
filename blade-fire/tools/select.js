import { setCursor } from "../common/index.js";

export function select(svg) {
    console.log("Select tool activated");
    if (svg) {
        setCursor(svg, "default");
    }
    
    return () => {
        console.log("Select tool deactivated");
    };
}