import { describe, expect, it } from 'vitest'
import { viewportDeficit, type ViewportFacts } from './viewport'

// Numbers taken from an iPhone 15 Pro home-screen app that showed the gap.
const broken: ViewportFacts = { standalone: true, innerWidth: 393, innerHeight: 793, screenHeight: 852, safeAreaTop: 59 }

describe('viewportDeficit', () => {
  it('extends the app by the missing height when a portrait home-screen app is short by the status bar', () => {
    expect(viewportDeficit(broken)).toBe(59)
  })

  it('does nothing when the viewport is the full screen', () => {
    expect(viewportDeficit({ ...broken, innerHeight: 852 })).toBe(0)
  })

  it('does nothing in a normal browser tab, where toolbars legitimately shrink the viewport', () => {
    expect(viewportDeficit({ ...broken, standalone: false })).toBe(0)
  })

  it('does nothing in landscape', () => {
    expect(viewportDeficit({ ...broken, innerWidth: 852, innerHeight: 393 })).toBe(0)
  })

  it('ignores shortfalls that do not match the top safe area', () => {
    expect(viewportDeficit({ ...broken, innerHeight: 700 })).toBe(0)
    expect(viewportDeficit({ ...broken, safeAreaTop: 20 })).toBe(0)
  })
})
