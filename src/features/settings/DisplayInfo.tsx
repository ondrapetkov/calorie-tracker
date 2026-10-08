import { useEffect, useState } from 'react'
import { Card } from '../../components/ui'

interface Info {
  standalone: boolean
  innerHeight: number
  visualViewportHeight: number | null
  clientHeight: number
  screenHeight: number
  rootHeight: number
  navBottom: number | null
  safeBottom: number
  safeTop: number
}

function measureSafeArea(side: 'top' | 'bottom'): number {
  const probe = document.createElement('div')
  probe.style.cssText = `position:fixed;visibility:hidden;pointer-events:none;padding-${side}:env(safe-area-inset-${side},0px)`
  document.body.appendChild(probe)
  const value = parseFloat(getComputedStyle(probe)[side === 'top' ? 'paddingTop' : 'paddingBottom']) || 0
  probe.remove()
  return value
}

function read(): Info {
  const nav = document.querySelector('nav')
  const nav_ = nav ? nav.getBoundingClientRect() : null
  return {
    standalone:
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true,
    innerHeight: window.innerHeight,
    visualViewportHeight: window.visualViewport ? Math.round(window.visualViewport.height) : null,
    clientHeight: document.documentElement.clientHeight,
    screenHeight: window.screen.height,
    rootHeight: Math.round(document.getElementById('root')?.getBoundingClientRect().height ?? 0),
    navBottom: nav_ ? Math.round(nav_.bottom) : null,
    safeBottom: measureSafeArea('bottom'),
    safeTop: measureSafeArea('top'),
  }
}

/** Layout numbers, so a display problem on a phone can be diagnosed from a screenshot. */
export function DisplayInfo() {
  const [info, setInfo] = useState<Info>(read)
  useEffect(() => {
    const update = () => setInfo(read())
    update()
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
    }
  }, [])

  const rows: [string, string][] = [
    ['Home Screen app', info.standalone ? 'yes' : 'no (browser tab)'],
    ['Window height', String(info.innerHeight)],
    ['Visual viewport height', info.visualViewportHeight === null ? 'n/a' : String(info.visualViewportHeight)],
    ['Document height', String(info.clientHeight)],
    ['Screen height', String(info.screenHeight)],
    ['App area height', String(info.rootHeight)],
    ['Tab bar bottom edge', info.navBottom === null ? 'n/a' : String(info.navBottom)],
    ['Safe area top / bottom', `${info.safeTop} / ${info.safeBottom}`],
  ]
  return (
    <Card>
      <h2 className="font-semibold">Display</h2>
      <p className="mt-1 text-sm text-muted">
        Layout numbers in points. The tab bar bottom edge should equal the window height. Send a screenshot of this if
        the layout looks wrong.
      </p>
      <dl className="mt-2 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between border-b border-line py-1 last:border-0">
            <dt className="text-muted">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}
