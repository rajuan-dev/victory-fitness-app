type RouterLike = {
  replace: (href: string) => void;
  back?: () => void;
  canGoBack?: () => boolean;
  push?: (href: string | { pathname: string; params?: Record<string, string> }) => void;
};

export function blurActiveElementBeforeNavigation() {
  if (typeof document === 'undefined') {
    return;
  }

  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLElement) {
    activeElement.blur();
  }
}

export function replaceRoute(router: RouterLike, href: string) {
  blurActiveElementBeforeNavigation();
  setTimeout(() => {
    router.replace(href);
  }, 0);
}

export function pushRoute(
  router: RouterLike,
  href: string | { pathname: string; params?: Record<string, string> }
) {
  if (typeof router.push !== 'function') {
    return;
  }

  blurActiveElementBeforeNavigation();
  setTimeout(() => {
    router.push?.(href);
  }, 0);
}

export function goBackOrReplace(router: RouterLike, fallbackHref: string) {
  blurActiveElementBeforeNavigation();

  if (typeof router.canGoBack === 'function' && typeof router.back === 'function' && router.canGoBack()) {
    router.back();
    return;
  }

  replaceRoute(router, fallbackHref);
}
