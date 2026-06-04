type RouterLike = {
  replace: (href: string) => void;
};

export function replaceRoute(router: RouterLike, href: string) {
  setTimeout(() => {
    router.replace(href);
  }, 0);
}
