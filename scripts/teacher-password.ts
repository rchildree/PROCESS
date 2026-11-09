// Sets the password that `?key` asks for. Run `npm run teacher-password`, then commit and push.
// `npm run teacher-password -- --remove` drops the password again.
import { randomBytes } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { Writable } from 'node:stream'
import { hashPassword } from '../src/core/password.ts'

const FILE = new URL('../src/core/data/teacherPassword.ts', import.meta.url)
const write = (value: string) => writeFileSync(FILE, `// Written by \`npm run teacher-password\`. null means ?key needs no password.
import type { PasswordHash } from '../password.ts'

export const TEACHER_PASSWORD: PasswordHash | null = ${value}
`)

if (process.argv.includes('--remove')) {
  write('null')
  console.log('Teacher password removed: ?key turns on teacher mode without one.')
  process.exit(0)
}

// Typed characters are not echoed.
let muted = false
const output = new Writable({ write(chunk, _enc, done) { if (!muted) process.stdout.write(chunk); done() } })
const rl = createInterface({ input: process.stdin, output, terminal: process.stdin.isTTY })
const lines = rl[Symbol.asyncIterator]()
const ask = async (q: string) => {
  process.stdout.write(q)
  muted = true
  const line = await lines.next()
  muted = false
  process.stdout.write('\n')
  return line.done ? '' : line.value
}

const first = await ask('New teacher password: ')
const again = await ask('Type it again: ')
rl.close()
if (!first.trim()) { console.error('The password can’t be empty.'); process.exit(1) }
if (first.trim() !== again.trim()) { console.error('Those didn’t match. Nothing changed.'); process.exit(1) }
if (first.trim().length < 8) console.warn('Tip: a longer password (8+ characters) is much harder to guess.')

const salt = randomBytes(16).toString('hex')
const hash = await hashPassword(first, salt)
write(JSON.stringify({ salt, hash }))
console.log('Saved. Commit and push src/core/data/teacherPassword.ts to put it on the site.')
console.log('Every browser already in teacher mode will be asked for the new password.')
