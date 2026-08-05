/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  // 运行时注入的 AI 卡片 HTML 也会用到这些类，需要 safelist
  safelist: [
    // 尺寸
    'w-[270px]', 'h-[360px]', 'w-full', 'h-full', 'h-[220px]',
    // 圆角
    'rounded-2xl', 'rounded-lg', 'rounded-full',
    // 阴影
    'shadow-2xl', 'shadow-lg', 'shadow-xl',
    // Flex
    'flex', 'flex-col', 'flex-row', 'flex-wrap', 'items-center', 'items-start', 'items-end',
    'justify-center', 'justify-between', 'justify-start', 'justify-end',
    'gap-1', 'gap-2', 'gap-3', 'gap-4',
    // 位置
    'relative', 'absolute', 'inset-0', 'inset-x-0',
    'top-0', 'left-0', 'bottom-0', 'right-0',
    // 溢出
    'overflow-hidden', 'line-clamp-2', 'line-clamp-3',
    // 字体
    'text-xs', 'text-sm', 'text-base', 'text-lg',
    'font-bold', 'font-medium', 'font-semibold', 'font-normal',
    'text-center', 'text-left', 'text-right',
    'leading-tight', 'leading-relaxed',
    // 颜色
    'text-white', 'text-gray-900', 'text-gray-600', 'text-gray-500', 'text-gray-400',
    'text-blue-500', 'text-red-400', 'text-purple-700',
    'bg-white', 'bg-gray-100', 'bg-gray-200',
    // 渐变遮罩
    'bg-gradient-to-t', 'bg-gradient-to-r', 'bg-gradient-to-b',
    'from-black/30', 'from-black/60', 'from-black/70',
    'via-black/30',
    'to-transparent',
    // 内边距
    'px-4', 'py-3', 'p-4', 'p-3',
    // 边框
    'border', 'border-white/20', 'border-white/30',
    // 其他
    'origin-top-left', 'origin-center',
    'object-cover',
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Noto Serif SC"', '"Source Han Serif SC"', 'STSong', 'serif'],
        sans: ['"Noto Sans SC"', '"PingFang SC"', '"Microsoft YaHei"', 'sans-serif'],
        kai: ['"Ma Shan Zheng"', '"KaiTi"', 'cursive'],
      },
    },
  },
  plugins: [],
}
