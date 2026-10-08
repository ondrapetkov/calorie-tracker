import { useEffect, useState } from 'react'
import { Card } from '../../components/ui'
import { isStandalone, measureSafeArea } from '../../platform/viewport'

interface Info {
  standalone: boolean
  deficit: number
  scrollable: boolean
  innerHeight: number
  visualViewportHeight: number | null
  clientHeight: number
  screenHeight: number
  rootHeight: number
  navBottom: number | null
  safeBottom: number
  safeTop: number
}

function read(): Info {
  const nav = document.querySelector('nav')
  const nav_ = nav ? nav.getBoundingClientRect() : null
  return {
    standalone: isStandalone(),
    deficit: parseFloat(document.documentElement.style.getPropertyValue('--viewport-deficit')) || 0,
    scrollable: document.documentElement.scrollHeight > window.innerHeight,
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
    ['Page can scroll (should be yes)', info.scrollable ? 'yes' : 'no'],
    ['Extra height applied', String(info.deficit)],
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
