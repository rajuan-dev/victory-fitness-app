type RouterLike = {
  replace: (href: string) => void;
  back?: () => void;
  canGoBack?: () => boolean;
};

export function replaceRoute(router: RouterLike, href: string) {
  setTimeout(() => {
    router.replace(href);
  }, 0);
}

export function goBackOrReplace(router: RouterLike, fallbackHref: string) {
  if (typeof router.canGoBack === 'function' && typeof router.back === 'function' && router.canGoBack()) {
    router.back();
    return;
  }

  replaceRoute(router, fallbackHref);
}
