import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: 'UNPAM Presensi',
    description: 'Cek persentase kehadiran kuliah dari portal my.unpam.ac.id',
    permissions: ['storage'],
    host_permissions: ['https://my.unpam.ac.id/*'],
  },
});
