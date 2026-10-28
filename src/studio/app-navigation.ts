export function navigateApp(href: string, replace = false) {
  const next = new URL(href, location.href);
  if (next.origin !== location.origin || next.pathname !== '/') {
    location.assign(next.href);
    return;
  }
  const previous = location.pathname + location.search;
  const state = { studioDepth: 0, walletReturnUrl: next.searchParams.get('page') === 'wallet' ? previous : null };
  history[replace ? 'replaceState' : 'pushState'](state, '', next);
  window.dispatchEvent(new PopStateEvent('popstate', { state }));
}
