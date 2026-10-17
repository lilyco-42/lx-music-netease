import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = resolve(root, 'apps', 'desktop', 'dist')
const html = readFileSync(resolve(dist, 'index.html'), 'utf8')
const links = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m => m[1]).filter(u => u.includes('assets/'))
if (!links.some(u => u.endsWith('.js')) || !links.some(u => u.endsWith('.css'))) throw Error('Missing JS/CSS entrypoint')
for (const link of links) {
 if (!link.startsWith('./assets/')) throw Error('Absolute Electron asset URL: ' + link)
 if (!existsSync(resolve(dist, link))) throw Error('Missing local asset ' + link)
}
console.log('Electron file:// asset smoke check passed',links.length)
