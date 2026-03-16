import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { startTransition } from "react";

export function navigateWithTransition(
  router: AppRouterInstance,
  href: string,
  options?: { onNavigate?: () => void }
) {
  const go = () => {
    options?.onNavigate?.();
    startTransition(() => {
      router.push(href);
    });
  };

  if (typeof document !== "undefined" && "startViewTransition" in document) {
    const viewTransitionDocument = document as Document & {
      startViewTransition?: (callback: () => void) => void;
    };
    const startViewTransition = viewTransitionDocument.startViewTransition?.bind(viewTransitionDocument);

    startViewTransition?.(() => {
      go();
    });
    return;
  }

  go();
}
