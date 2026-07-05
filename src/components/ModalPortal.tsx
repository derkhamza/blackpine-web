import { ReactNode } from "react";
import { createPortal } from "react-dom";

// Render a modal/overlay as a direct child of <body>, escaping any ancestor
// that establishes a containing block for position:fixed (a transform/filter on
// an animated page container, etc.). Without this, a fixed overlay can be
// trapped inside the scrolling page area, so its dim/blur only covers the
// initial viewport and scrolling reveals unblurred content below. React context
// (i18n, cabinet) still flows through a portal normally.
export function ModalPortal({ children }: { children: ReactNode }) {
  if (typeof document === "undefined") return <>{children}</>;
  return createPortal(children, document.body);
}
