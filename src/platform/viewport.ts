export interface ViewportFacts {
  standalone: boolean
  innerWidth: number
  innerHeight: number
  /** The device's screen height in points (portrait). */
  screenHeight: number
  safeAreaTop: number
}

/**
 * iOS home-screen apps sometimes report a layout viewport that is shorter than the screen by
 * the status-bar height (observed: 793 of 852 points, with a top safe area of 59), which leaves
 * a gap under the tab bar. Returns how many points to extend the app downwards, or 0 when
 * the viewport looks normal. Deliberately narrow: only a portrait home-screen app whose
 * shortfall matches the top safe area is touched.
 */
export function viewportDeficit(f: ViewportFacts): number {
  if (!f.standalone) return 0
  if (f.innerHeight <= f.innerWidth) return 0 // landscape
  const deficit = f.screenHeight - f.innerHeight
  if (deficit < 20 || deficit > 100) return 0
  if (Math.abs(deficit - f.safeAreaTop) > 3) return 0
  return deficit
}

export function measureSafeArea(side: 'top' | 'bottom'): number {
  const probe = document.createElement('div')
  probe.style.cssText = `position:fixed;visibility:hidden;pointer-events:none;padding-${side}:env(safe-area-inset-${side},0px)`
  document.body.appendChild(probe)
  const value = parseFloat(getComputedStyle(probe)[side === 'top' ? 'paddingTop' : 'paddingBottom']) || 0
  probe.remove()
  return value
}

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

/** The screen's portrait height, whichever way iOS reports width and height. */
export function portraitScreenHeight(): number {
  return Math.max(window.screen.height, window.screen.width)
}

/** Apply the compensation to #root and keep it up to date. Returns the current value. */
export function installViewportFix(): () => number {
  let current = 0
  const apply = () => {
    current = viewportDeficit({
      standalone: isStandalone(),
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      screenHeight: portraitScreenHeight(),
      safeAreaTop: measureSafeArea('top'),
    })
    document.documentElement.style.setProperty('--viewport-deficit', `${current}px`)
  }
  apply()
  window.addEventListener('resize', apply)
  window.addEventListener('orientationchange', apply)
  document.addEventListener('visibilitychange', apply)
  return () => current
}
