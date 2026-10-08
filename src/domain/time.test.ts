import { describe, expect, it } from 'vitest'
import { timeAgo } from './time'

const now = Date.parse('2026-10-08T12:00:00Z')
const ago = (ms: number) => now - ms

describe('timeAgo', () => {
  it('describes recent times in plain words', () => {
    expect(timeAgo(ago(5_000), now)).toBe('just now')
    expect(timeAgo(ago(60_000), now)).toBe('1 min ago')
    expect(timeAgo(ago(5 * 60_000), now)).toBe('5 min ago')
    expect(timeAgo(ago(3 * 3_600_000), now)).toBe('3 h ago')
  })

  it('falls back to a date after a day, and treats a clock skew into the future as just now', () => {
    expect(timeAgo(ago(30 * 3_600_000), now)).toMatch(/7 Oct/)
    expect(timeAgo(now + 10_000, now)).toBe('just now')
  })
})
