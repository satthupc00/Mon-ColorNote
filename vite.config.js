import { defineConfig } from 'vite';
import pkg from './package.json' with { type: 'json' };
export default defineConfig({ define: { __APP_VERSION__: JSON.stringify(pkg.version) }, base: './', build: { outDir: 'dist', emptyOutDir: true, target: 'es2020' } });
