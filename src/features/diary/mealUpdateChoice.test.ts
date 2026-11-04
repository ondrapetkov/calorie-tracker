import { describe, expect, it } from 'vitest'
import { rememberChoice, rememberedChoice } from './mealUpdateChoice'

function fakeStore() {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  }
}

describe('meal update choice', () => {
  it('is null when nothing is stored', () => {
    expect(rememberedChoice(fakeStore(), 'm1', '2026-11-04', '2026-11-04')).toBeNull()
  })

  it('reads back the answer for the same meal and date only', () => {
    const s = fakeStore()
    rememberChoice(s, 'm1', '2026-11-04', '2026-11-04', 'entry')
    rememberChoice(s, 'm2', '2026-11-04', '2026-11-04', 'meal')
    expect(rememberedChoice(s, 'm1', '2026-11-04', '2026-11-04')).toBe('entry')
    expect(rememberedChoice(s, 'm2', '2026-11-04', '2026-11-04')).toBe('meal')
    expect(rememberedChoice(s, 'm3', '2026-11-04', '2026-11-04')).toBeNull()
    expect(rememberedChoice(s, 'm1', '2026-11-03', '2026-11-04')).toBeNull()
  })

  it('forgets answers once the day is over', () => {
    const s = fakeStore()
    rememberChoice(s, 'm1', '2026-11-04', '2026-11-04', 'meal')
    expect(rememberedChoice(s, 'm1', '2026-11-04', '2026-11-05')).toBeNull()
    rememberChoice(s, 'm2', '2026-11-05', '2026-11-05', 'entry')
    expect(JSON.parse(s.getItem('meal-update-choices')!).choices).toEqual({ 'm2|2026-11-05': 'entry' })
  })

  it('treats corrupt data as nothing stored', () => {
    const s = fakeStore()
    s.setItem('meal-update-choices', '{not json')
    expect(rememberedChoice(s, 'm1', '2026-11-04', '2026-11-04')).toBeNull()
    s.setItem('meal-update-choices', '"x"')
    expect(rememberedChoice(s, 'm1', '2026-11-04', '2026-11-04')).toBeNull()
    rememberChoice(s, 'm1', '2026-11-04', '2026-11-04', 'meal')
    expect(rememberedChoice(s, 'm1', '2026-11-04', '2026-11-04')).toBe('meal')
  })
})
