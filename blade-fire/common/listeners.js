/**
 * Manages a group of event listeners via AbortController.
 * Call activate() before binding; call dispose() to remove all listeners at once.
 */
export function createListenerManager() {
    let controller = null;

    return {
        activate() {
            controller?.abort();
            controller = new AbortController();
            return controller.signal;
        },

        on(target, type, handler, options) {
            if (!controller) {
                controller = new AbortController();
            }
            const opts = options == null
                ? { signal: controller.signal }
                : typeof options === "boolean"
                    ? { capture: options, signal: controller.signal }
                    : { ...options, signal: controller.signal };
            target.addEventListener(type, handler, opts);
        },

        dispose() {
            controller?.abort();
            controller = null;
        },
    };
}
