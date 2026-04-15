function normalizePath(pathname = '/') {
  if (!pathname) return '/';

  let path = pathname.trim();

  if (!path.startsWith('/')) {
    path = `/${path}`;
  }

  // trailing slash 제거 (루트 제외)
  path = path.replace(/\/+$/, '');
  return path === '' ? '/' : path;
}

function splitPath(pathname = '/') {
  const normalized = normalizePath(pathname);

  if (normalized === '/') {
    return [];
  }

  return normalized.slice(1).split('/');
}

function parseQuery(searchParams) {
  const query = {};

  for (const [key, value] of searchParams.entries()) {
    if (key in query) {
      if (Array.isArray(query[key])) {
        query[key].push(value);
      } else {
        query[key] = [query[key], value];
      }
    } else {
      query[key] = value;
    }
  }

  return query;
}

function matchPattern(pattern, pathname) {
  if (pattern === '*') {
    return {};
  }

  const patternSegments = splitPath(pattern);
  const pathSegments = splitPath(pathname);

  const params = {};
  let pathIndex = 0;

  for (let i = 0; i < patternSegments.length; i += 1) {
    const patternSegment = patternSegments[i];
    const currentPathSegment = pathSegments[pathIndex];

    const isParam = patternSegment.startsWith(':');
    const isOptionalParam = isParam && patternSegment.endsWith('?');

    if (isParam) {
      const paramName = patternSegment.slice(1, isOptionalParam ? -1 : undefined);

      if (currentPathSegment == null) {
        if (isOptionalParam) {
          params[paramName] = undefined;
          continue;
        }
        return null;
      }

      params[paramName] = decodeURIComponent(currentPathSegment);
      pathIndex += 1;
      continue;
    }

    if (currentPathSegment == null) {
      return null;
    }

    if (patternSegment !== currentPathSegment) {
      return null;
    }

    pathIndex += 1;
  }

  // path가 더 남아 있으면 불일치
  if (pathIndex !== pathSegments.length) {
    return null;
  }

  return params;
}

function findRoute(routes, pathname) {
  const normalizedPath = normalizePath(pathname);

  for (const route of routes) {
    const params = matchPattern(route.path, normalizedPath);
    if (params) {
      return { route, params };
    }
  }

  return null;
}

function renderNotFound(app, pathname) {
  app.innerHTML = `
    <section class="not-found-page">
      <h1>404</h1>
      <p>요청한 페이지를 찾을 수 없습니다.</p>
      <p><code>${pathname}</code></p>
      <p><a href="/" data-link>홈으로 돌아가기</a></p>
    </section>
  `;
}

function renderError(app, error) {
  console.error(error);

  app.innerHTML = `
    <section class="error-page">
      <h1>문제가 발생했습니다</h1>
      <p>페이지를 렌더링하는 중 오류가 발생했습니다.</p>
    </section>
  `;
}

function updateActiveLinks(currentPathname) {
  const current = normalizePath(currentPathname);
  const links = document.querySelectorAll('a[data-link]');

  for (const link of links) {
    const url = new URL(link.href, window.location.origin);
    const linkPath = normalizePath(url.pathname);
    const isActive = current === linkPath;

    link.classList.toggle('is-active', isActive);

    if (isActive) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  }
}

export function createRouter({ app, routes }) {
  if (!app) {
    throw new Error('Router 생성 시 app 요소가 필요합니다.');
  }

  if (!Array.isArray(routes) || routes.length === 0) {
    throw new Error('Router 생성 시 routes 배열이 필요합니다.');
  }

  let currentCleanup = null;

  async function runCleanup() {
    if (typeof currentCleanup === 'function') {
      try {
        await currentCleanup();
      } catch (error) {
        console.error('페이지 cleanup 중 오류:', error);
      }
    }

    currentCleanup = null;
  }

  async function render(url = new URL(window.location.href), options = {}) {
    const { scrollTop = false } = options;
    const pathname = normalizePath(url.pathname);
    const matched = findRoute(routes, pathname);

    await runCleanup();

    app.setAttribute('aria-busy', 'true');

    try {
      if (!matched) {
        renderNotFound(app, pathname);
        updateActiveLinks(pathname);

        if (scrollTop) {
          window.scrollTo(0, 0);
        }

        return;
      }

      const { route, params } = matched;
      const pageModule = await route.load();
      const renderPage = pageModule.default || pageModule.render;

      if (typeof renderPage !== 'function') {
        throw new Error(`"${route.path}" 페이지 모듈에 default export 함수가 없습니다.`);
      }

      const ctx = {
        app,
        params,
        query: parseQuery(url.searchParams),
        path: pathname,
        url,
        navigate,
        replace,
      };

      const result = await renderPage(ctx);

      // 1) 문자열 반환 -> innerHTML로 렌더
      if (typeof result === 'string') {
        app.innerHTML = result;
      }

      // 2) cleanup 함수 반환
      if (typeof result === 'function') {
        currentCleanup = result;
      }

      // 3) { html, cleanup } 형태 반환
      if (result && typeof result === 'object') {
        if (typeof result.html === 'string') {
          app.innerHTML = result.html;
        }

        if (typeof result.cleanup === 'function') {
          currentCleanup = result.cleanup;
        }
      }

      updateActiveLinks(pathname);

      if (scrollTop) {
        window.scrollTo(0, 0);
      }
    } catch (error) {
      renderError(app, error);
    } finally {
      app.removeAttribute('aria-busy');
    }
  }

  async function navigate(to, options = {}) {
    const { state = {}, scrollTop = true } = options;
    const nextUrl = new URL(to, window.location.origin);

    history.pushState(state, '', nextUrl);
    await render(nextUrl, { scrollTop });
  }

  async function replace(to, options = {}) {
    const { state = {}, scrollTop = false } = options;
    const nextUrl = new URL(to, window.location.origin);

    history.replaceState(state, '', nextUrl);
    await render(nextUrl, { scrollTop });
  }

  function handleDocumentClick(event) {
    if (event.defaultPrevented) return;
    if (event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const anchor = event.target.closest('a[data-link]');
    if (!anchor) return;

    if (anchor.target === '_blank') return;
    if (anchor.hasAttribute('download')) return;

    const url = new URL(anchor.href, window.location.origin);

    if (url.origin !== window.location.origin) return;

    event.preventDefault();
    navigate(`${url.pathname}${url.search}${url.hash}`);
  }

  function handlePopState() {
    render(new URL(window.location.href), { scrollTop: false });
  }

  async function start() {
    document.addEventListener('click', handleDocumentClick);
    window.addEventListener('popstate', handlePopState);

    await render(new URL(window.location.href), { scrollTop: false });
  }

  async function stop() {
    document.removeEventListener('click', handleDocumentClick);
    window.removeEventListener('popstate', handlePopState);
    await runCleanup();
  }

  return {
    start,
    stop,
    navigate,
    replace,
    render,
  };
}