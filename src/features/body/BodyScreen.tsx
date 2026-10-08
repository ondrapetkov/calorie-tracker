import { Segmented } from '../../components/Segmented'
import { TargetsPanel } from '../targets/TargetsPanel'
import { WaterSection } from './WaterSection'
import { WeightSection } from './WeightSection'

export type BodySection = 'weight' | 'water' | 'targets'

interface Props {
  section: BodySection
  onSectionChange: (section: BodySection) => void
}

export function BodyScreen({ section, onSectionChange }: Props) {
  return (
    <div className="mx-auto max-w-xl space-y-4 px-4 pb-8 pt-[calc(env(safe-area-inset-top)+1rem)]">
      <h1 className="text-xl font-semibold">Body</h1>
      <Segmented
        label="Body section"
        value={section}
        onChange={onSectionChange}
        options={[
          { id: 'weight', label: 'Weight' },
          { id: 'water', label: 'Water' },
          { id: 'targets', label: 'Targets' },
        ]}
      />
      {section === 'weight' && <WeightSection />}
      {section === 'water' && <WaterSection />}
      {section === 'targets' && <TargetsPanel />}
    </div>
  )
}
