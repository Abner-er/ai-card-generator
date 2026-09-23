import { defineConfig } from 'vitest/config';

// 纯逻辑回归测试：只跑 blocks/ 下的规则代码，node 环境即可，
// 不复用 vite.config 的 dev-server 中间件（那套是抓取代理，测试里用不到）。
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globals: false,
  },
});
