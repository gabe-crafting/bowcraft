import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { dirname, extname, join, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json',
}

/** Built client, two levels up from this file. */
export function clientDirectory(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '../../client/dist')
}

/** Serves the built game. A missing page falls back to the shell. */
export async function serveClient(
  root: string,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405).end()
    return
  }

  const path = requestPath(request.url ?? '/')
  const full = inside(root, path === '/' ? 'index.html' : path.slice(1))
  const file = (full && (await readableFile(full))) || (extname(path) === '' ? await readableFile(join(root, 'index.html')) : null)
  if (!file) {
    response.writeHead(404).end()
    return
  }

  const headers: Record<string, string> = {
    'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
  }
  if (file.includes(`${sep}assets${sep}`)) headers['cache-control'] = 'public, max-age=31536000, immutable'
  response.writeHead(200, headers)
  if (request.method === 'HEAD') {
    response.end()
    return
  }
  createReadStream(file).pipe(response)
}

function requestPath(url: string): string {
  const raw = url.split('?')[0] ?? '/'
  try {
    return decodeURIComponent(raw) || '/'
  } catch {
    return '/'
  }
}

function inside(root: string, relative: string): string | null {
  const rootPrefix = normalize(root + sep)
  const full = normalize(join(root, relative))
  if (full !== normalize(root) && !full.startsWith(rootPrefix)) return null
  return full
}

async function readableFile(path: string): Promise<string | null> {
  try {
    const info = await stat(path)
    return info.isFile() ? path : null
  } catch {
    return null
  }
}
