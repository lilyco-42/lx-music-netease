// lyco_music 下载镜像 —— 公开只读 R2 桶。
// 只允许 GET/HEAD；对象不存在返回 404；路径即桶内 key（/lyco_music/v0.2.0-xxx/xxx.apk）。
// 大文件走 R2 get() 流式返回，Cloudflare 边缘缓存 1 天（安装包不可变，缓存安全）。
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
  txt: 'text/plain',
};

export default {
  async fetch(request, env) {
    if (!['GET', 'HEAD'].includes(request.method)) {
      return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
    }
    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return Response.json({ ok: true, storage: 'R2', bucket: env.BUCKET?.bucketName ?? 'lyco-music-dl' });
    }

    const key = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    if (!key) {
      // 根路径给个简单索引提示，不暴露桶列表
      return new Response('Lyco Music download mirror. See https://lain42.top/downloads/ for the catalog.\n', {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
    // 防目录穿越
    if (key.includes('..')) return new Response('Not Found', { status: 404 });

    const obj = await env.BUCKET.get(key);
    if (obj === null) return new Response('Not Found', { status: 404 });

    const ext = key.includes('.') ? key.split('.').pop() : '';
    const type = TYPES[ext] ?? 'application/octet-stream';
    const headers = new Headers();
    headers.set('Content-Type', type);
    headers.set('Content-Length', String(obj.size));
    headers.set('ETag', obj.httpEtag);
    // 安装包不可变：边缘+浏览器都可以长缓存；manifest.json 用短缓存便于更新
    const shortTtl = key.endsWith('manifest.json') || key.endsWith('SHA256SUMS.txt');
    headers.set('Cache-Control', shortTtl ? 'public, max-age=60' : 'public, max-age=86400');
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Accept-Ranges', 'bytes');

    if (request.method === 'HEAD') {
      // R2 的 body 拿出来就不能再用了；HEAD 只回元数据
      return new Response(null, { status: 200, headers });
    }

    // Range 支持（下载器断点续传）
    const range = request.headers.get('range');
    if (range) {
      return handleRange(obj, range, type);
    }
    return new Response(obj.body, { status: 200, headers });
  },
};

function handleRange(obj, range, type) {
  const m = range.match(/bytes=(\d+)-(\d*)/);
  if (!m) return new Response(obj.body, { status: 200, headers: { 'Content-Type': type } });
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
    },
  });
}
