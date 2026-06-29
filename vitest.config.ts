import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts', 'scripts/**/*.{test,spec}.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@ai-balancer': path.resolve(__dirname, 'src/modules/ai-balancer'),
      '@users': path.resolve(__dirname, 'src/modules/users'),
      '@shared': path.resolve(__dirname, 'src/modules/shared'),
    },
  },
});
