import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // 注意：更具体的路径要放在前面，否则会被更短的路径覆盖
      // 通义万相图片生成 - 查询任务结果
      '/api/generate-image/tongyi/query': {
        target: 'https://ws-ob2jzjdqb8c0y0tw.cn-beijing.maas.aliyuncs.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => {
          const taskId = path.split('?task_id=')[1];
          return `/api/v1/tasks/${taskId}`;
        },
      },
      // 通义万相图片生成 - 创建任务
      '/api/generate-image/tongyi': {
        target: 'https://ws-ob2jzjdqb8c0y0tw.cn-beijing.maas.aliyuncs.com',
        changeOrigin: true,
        secure: true,
        rewrite: () => '/api/v1/services/aigc/text2image/image-synthesis',
      },
      // 文心一格图片生成（预留）
      '/api/generate-image/wenxin': {
        target: 'https://aip.baidubce.com',
        changeOrigin: true,
        secure: true,
      },
    },
  },
});
