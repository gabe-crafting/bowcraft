import { join } from 'node:path'
import { spawn } from 'bun'

const root = join(import.meta.dir, '..')

const server = spawn({
  cmd: ['bun', '--watch', 'server/src/index.ts'],
  cwd: root,
  stdout: 'inherit',
  stderr: 'inherit',
})

const client = spawn({
  cmd: ['bun', 'run', 'dev'],
  cwd: join(root, 'client'),
  stdout: 'inherit',
  stderr: 'inherit',
})

function stop(): void {
  server.kill()
  client.kill()
}

process.on('SIGINT', stop)
process.on('SIGTERM', stop)

const code = await Promise.race([server.exited, client.exited])
stop()
process.exit(code)
