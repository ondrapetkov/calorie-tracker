import { useState, type ReactNode } from 'react'
import { DiaryScreen } from './features/diary/DiaryScreen'
import { FoodsScreen } from './features/foods/FoodsScreen'
import { MealsScreen } from './features/meals/MealsScreen'
import { MoreScreen } from './features/settings/MoreScreen'
import { BodyScreen, type BodySection } from './features/body/BodyScreen'

type Tab = 'diary' | 'meals' | 'foods' | 'body' | 'more'

const icon = (d: string) => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
)

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: 'diary', label: 'Diary', icon: icon('M5 4h14v16H5zM8 9h8M8 13h8M8 17h5') },
  { id: 'meals', label: 'Meals', icon: icon('M4 8h16v3H4zM6 11v8h12v-8M9 5h6') },
  { id: 'foods', label: 'Foods', icon: icon('M4 11h16M6 11a6 6 0 0 0 12 0M9 7c0-2 3-2 3-4M14 7c0-2 3-2 3-4') },
  { id: 'body', label: 'Body', icon: icon('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01') },
  { id: 'more', label: 'More', icon: icon('M5 12h.01M12 12h.01M19 12h.01') },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('diary')
  const [bodySection, setBodySection] = useState<BodySection>('weight')
  return (
    <>
      {/* key resets the scroll position when switching tabs */}
      <div key={tab} className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-bg">
        {tab === 'diary' && <DiaryScreen
            onOpenTargets={() => {
              setBodySection('targets')
              setTab('body')
            }}
          />}
        {tab === 'meals' && <MealsScreen />}
        {tab === 'foods' && <FoodsScreen />}
        {tab === 'body' && <BodyScreen section={bodySection} onSectionChange={setBodySection} />}
        {tab === 'more' && <MoreScreen />}
      </div>
      <nav className="shrink-0 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-xl">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${
                tab === t.id ? 'text-accent' : 'text-muted'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </>
  )
}
