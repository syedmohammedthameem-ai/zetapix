// @ts-check

import mdx from '@astrojs/mdx'
import sitemap from '@astrojs/sitemap'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'

import react from '@astrojs/react';

export default defineConfig({
  base: '/',
  site: process.env.PUBLIC_SITE_URL ?? 'http://localhost:4321',
  integrations: [mdx(), sitemap(), react()],
  output: 'static',
  outDir: 'dist',
  vite: {
    plugins: [tailwindcss()],
    build: {
      rollupOptions: {
        external: ['@resvg/resvg-js'],
      },
    },
  },
  markdown: {
    shikiConfig: {
      theme: 'catppuccin-mocha',
    },
  },
})
