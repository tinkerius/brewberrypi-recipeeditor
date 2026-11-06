/** Loads one of Google's scripts once (allowed by the page's Content-Security-Policy). */

const loading = new Map<string, Promise<void>>();

export function loadScript(src: string): Promise<void> {
  let promise = loading.get(src);
  if (!promise) {
    promise = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        loading.delete(src);
        script.remove();
        reject(new Error(`Could not load ${new URL(src).host}. Check the network connection or content blockers.`));
      };
      document.head.append(script);
    });
    loading.set(src, promise);
  }
  return promise;
}
