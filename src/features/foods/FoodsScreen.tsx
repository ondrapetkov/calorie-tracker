import { FoodsPanel } from './FoodsPanel'

export function FoodsScreen() {
  return (
    <div className="mx-auto max-w-xl space-y-4 px-4 pb-8 pt-[calc(env(safe-area-inset-top)+1rem)]">
      <h1 className="text-xl font-semibold">Foods</h1>
      <FoodsPanel />
    </div>
  )
}
