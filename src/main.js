import './styles/base.css';
import { createRouter } from './router.js';
// 나중에 인증 붙일 때 사용
// import { ensureAnonymousSession } from './lib/auth.js';

const app = document.querySelector('#app');

if (!app) {
  throw new Error('#app 요소를 찾을 수 없습니다.');
}

const routes = [
  {
    path: '/',
    load: () => import('./pages/home-page.js'),
  },
  {
    path: '/studio',
    load: () => import('./pages/studio-page.js'),
  },
  {
    path: '/create',
    load: () => import('./pages/create-page.js'),
  },
  {
    path: '/studio/:museumId/edit',
    load: () => import('./pages/edit-page.js'),
  },
  {
    path: '/m/:publicId/:slug?',
    load: () => import('./pages/museum-page.js'),
  },
];

const router = createRouter({
  app,
  routes,
});

async function bootstrap() {
  // 로그인 UI는 없지만 내부적으로 익명 세션을 쓰고 싶다면 여기서 실행
  // await ensureAnonymousSession();

  await router.start();
}

bootstrap().catch((error) => {
  console.error(error);
  app.innerHTML = `
    <section class="error-page">
      <h1>문제가 발생했습니다</h1>
      <p>앱을 시작하는 중 오류가 발생했습니다.</p>
    </section>
  `;
});

if (import.meta.env.DEV) {
  window.__router = router;
}