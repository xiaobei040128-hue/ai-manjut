// The customer app is the root entry; retain every functional route parameter.
export function cleanAppUrl(href: string, base = location.href) {
  const next = new URL(href, base);
  if (next.origin === new URL(base).origin && next.pathname === '/' && next.searchParams.get('view') === 'app') next.searchParams.delete('view');
  return next;
}
if (typeof window !== 'undefined' && location.pathname === '/' && new URLSearchParams(location.search).get('view') === 'app') {
  history.replaceState(history.state, '', cleanAppUrl(location.href));
}

export function navigateApp(href: string, replace = false) {
  const next = cleanAppUrl(href);
  if (next.origin !== location.origin || next.pathname !== '/') {
    location.assign(next.href);
    return;
  }
  const previous = location.pathname + location.search;
  const state = { studioDepth: 0, walletReturnUrl: next.searchParams.get('page') === 'wallet' ? previous : null };
  history[replace ? 'replaceState' : 'pushState'](state, '', next);
  window.dispatchEvent(new PopStateEvent('popstate', { state }));
}
