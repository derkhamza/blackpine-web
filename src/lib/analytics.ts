import { postEvents, isLoggedIn } from "../api/client";

// Lightweight behavioural analytics: queues event names and flushes them in
// batches to the backend. Logs only sanitized names (no PII). No-ops when the
// user isn't signed in (so the public booking page / login aren't tracked).

let queue: string[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let lastPage = "";

function flush() {
  if (timer) { clearTimeout(timer); timer = null; }
  if (queue.length === 0) return;
  const batch = queue.splice(0, 50);
  void postEvents(batch);
}

function schedule() {
  if (queue.length >= 10) { flush(); return; }
  if (!timer) timer = setTimeout(flush, 5000);
}

export function track(name: string): void {
  if (!isLoggedIn()) return;
  queue.push(name);
  schedule();
}

/** Track a route change as a page view (IDs normalized so screens group). */
export function trackPage(path: string): void {
  const norm = (path || "/")
    .replace(/\/[0-9a-f]{8,}(-[0-9a-f-]+)?$/i, "/:id")  // uuid / hex ids
    .replace(/\/\d+$/, "/:id");                          // numeric ids
  if (norm === lastPage) return;
  lastPage = norm;
  track("page:" + norm);
}

// Flush whatever is queued when the tab is hidden/closed.
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
}
