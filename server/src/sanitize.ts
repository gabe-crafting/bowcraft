import { DEFAULT_USERNAME, USERNAME_MAX_LENGTH } from '@bounty/shared'

function isControlChar(char: string): boolean {
  const code = char.charCodeAt(0)
  return code <= 31 || code === 127
}

export function sanitizeUsername(value: string): string {
  let cleaned = ''
  for (const char of value) {
    if (!isControlChar(char)) cleaned += char
  }
  cleaned = cleaned.trim().slice(0, USERNAME_MAX_LENGTH)
  if (cleaned.length === 0) return DEFAULT_USERNAME
  return cleaned
}
