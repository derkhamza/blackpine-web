import { getVapidKey, webPushSubscribe, getToken, getSecretaryToken } from "../api/client";

// Browser web-push: subscribe this device so the doctor/secretary gets a system
// notification for a signal even when the Blackpine tab is backgrounded/closed
// (the in-app poll only runs while the tab is visible). Pairs with the SW handler
// in public/push-sw.js. Best-effort throughout — a browser that blocks push just
// keeps the in-app toast.

export function webPushSupported(): boolean {
  return typeof navigator !== "undefined"
    && "serviceWorker" in navigator
    && typeof window !== "undefined"
    && "PushManager" in window
    && "Notification" in window;
}

export function webPushPermission(): NotificationPermission | "unsupported" {
  return webPushSupported() ? Notification.permission : "unsupported";
}

function urlB64ToUint8Array(base64: string): Uint8Array {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export type EnableResult = "ok" | "denied" | "unsupported" | "no-session" | "error";

// `prompt=false` → silent: only proceeds if permission is already granted (safe to
// call on every app load). `prompt=true` → asks (must come from a user gesture).
export async function enableWebPush(prompt: boolean): Promise<EnableResult> {
  try {
    if (!webPushSupported()) return "unsupported";
    if (!(getToken() || getSecretaryToken())) return "no-session";

    let perm = Notification.permission;
    if (perm === "default") {
      if (!prompt) return "denied";
      perm = await Notification.requestPermission();
    }
    if (perm !== "granted") return "denied";

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const key = await getVapidKey();
      if (!key) return "error";
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(key),
      });
    }
    return (await webPushSubscribe(sub.toJSON())) ? "ok" : "error";
  } catch {
    return "error";
  }
}
