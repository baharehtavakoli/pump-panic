// Vite settings
import fs from 'node:fs';

export default {
  base: './', // relative paths, so the built game works on GitHub Pages
  server: { host: true, port: 5174 },
  plugins: [
    {
      // DEV ONLY: lets src/dev/og-maker.js save the link-preview images
      // into public/ (open http://localhost:5174/#make-og). Not part of the build.
      name: 'save-og-image',
      configureServer(server) {
        server.middlewares.use('/__save-og', (req, res) => {
          const name = new URL(req.url, 'http://x').searchParams.get('name') || '';
          if (!/^og-[a-z-]+\.png$/.test(name)) return res.end('bad name');
          const chunks = [];
          req.on('data', (c) => chunks.push(c));
          req.on('end', () => {
            fs.writeFileSync(`public/${name}`, Buffer.concat(chunks));
            res.end('saved ' + name);
          });
        });
      },
    },
  ],
};
