import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { validateProductionEnvironment } from './src/environmentConfig.js';

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  if (command === 'build') {
    validateProductionEnvironment(env);
  }

  return {
    plugins: [react()],
    build: { manifest: true },
    worker: { format: 'es' },
  };
});
