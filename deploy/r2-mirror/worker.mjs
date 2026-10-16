// lyco_music 下载镜像 —— 公开只读 R2 桶，同时承载「下载页本身」。
//
// 两类内容：
//   1. 安装包（lyco_music/<tag>/Lyco.Music-*）—— 大文件，边缘缓存 1 天
//   2. 下载页静态资源（downloads/index.html、downloads/downloads.css、
//      assets/studio.css、assets/studio.js、downloads/manifest.json）
//      —— 让下载页也能从 R2 边缘打开，不依赖韩国那台回源
//
// 目录式路径（/downloads/ 或 /downloads）会回落到 <key>index.html。
const TYPES = {
  apk: 'application/vnd.android.package-archive',
  ipa: 'application/octet-stream',
  dmg: 'application/x-apple-diskimage',
  msi: 'application/x-msi',
  exe: 'application/vnd.microsoft.portable-executable',
  AppImage: 'application/x-executable',
  blockmap: 'application/json',
  yml: 'text/yaml',
  json: 'application/json',
  html: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  ico: 'image/x-icon',
  woff2: 'font/woff2',
  txt: 'text/plain; charset=utf-8',
};

function notFound() {
  return new Response('Not Found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
}

export default {
  async fetch(request, env) {
    if (!['GET', 'HEAD'].includes(request.method)) {
      return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
    }
    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return Response.json({ ok: true, storage: 'R2', bucket: env.BUCKET?.bucketName ?? 'lyco-music-dl' });
    }

    let key = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    if (key.includes('..')) return notFound();
    // 目录式路径落到 index.html：/ → index.html，/downloads/ → downloads/index.html
    if (key === '' || key.endsWith('/')) key += 'index.html';

    let obj = await env.BUCKET.get(key);
    if (obj === null && !key.split('/').pop().includes('.')) {
      const alt = key.replace(/\/?$/, '/') + 'index.html';
      obj = await env.BUCKET.get(alt);
      if (obj !== null) key = alt;
    }
    if (obj === null) return notFound();

    const ext = key.includes('.') ? key.split('.').pop() : '';
    const type = TYPES[ext] ?? 'application/octet-stream';
    // 安装包不可变 → 长缓存；页面/manifest 用短缓存，发新版后能及时生效
    const volatile = key.endsWith('manifest.json') || key.endsWith('.html')
      || key.endsWith('.css') || key.endsWith('.js') || key.endsWith('SHA256SUMS.txt');

    const headers = new Headers();
    headers.set('Content-Type', type);
    headers.set('Content-Length', String(obj.size));
    headers.set('ETag', obj.httpEtag);
    headers.set('Cache-Control', volatile ? 'public, max-age=60' : 'public, max-age=86400');
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Referrer-Policy', 'no-referrer');

    if (request.method === 'HEAD') return new Response(null, { status: 200, headers });

    const range = request.headers.get('range');
    if (range && !volatile) {
      const m = range.match(/bytes=(\d+)-(\d*)/);
      if (m) {
        const start = Number(m[1]);
        const end = m[2] ? Math.min(Number(m[2]), obj.size - 1) : obj.size - 1;
        if (start >= obj.size || start > end) {
          return new Response('Range Not Satisfiable', { status: 416 });
        }
        const slice = obj.body.slice(start, end + 1);
        return new Response(slice, {
          status: 206,
          headers: {
            'Content-Type': type,
            'Content-Range': 'bytes ' + start + '-' + end + '/' + obj.size,
            'Content-Length': String(end - start + 1),
            'Accept-Ranges': 'bytes',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': headers.get('Cache-Control'),
          },
        });
      }
    }
    return new Response(obj.body, { status: 200, headers });
  },
};
