import { useEffect, useState } from 'react'
import { Button, Card } from '../../components/ui'
import { repo } from '../../db/repo'
import { SyncCard } from './SyncCard'

type Persisted = 'unknown' | 'yes' | 'no' | 'unsupported'

async function readPersisted(): Promise<Persisted> {
  if (!navigator.storage?.persisted) return 'unsupported'
  return (await navigator.storage.persisted()) ? 'yes' : 'no'
}

export function MoreScreen() {
  const [persisted, setPersisted] = useState<Persisted>('unknown')
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    void readPersisted().then(setPersisted)
  }, [])

  const requestPersist = async () => {
    await navigator.storage?.persist?.()
    setPersisted(await readPersisted())
  }

  const exportJson = async () => {
    const dump = await repo.exportAll()
    const name = `calorie-tracker-${new Date().toISOString().slice(0, 10)}.json`
    const file = new File([JSON.stringify(dump, null, 2)], name, { type: 'application/json' })
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: name })
        setMessage('Backup shared.')
        return
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
    }
    const url = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    URL.revokeObjectURL(url)
    setMessage('Backup downloaded.')
  }

  return (
    <div className="mx-auto max-w-xl space-y-4 px-4 pb-8 pt-[calc(env(safe-area-inset-top)+1rem)]">
      <h1 className="text-xl font-semibold">More</h1>

      <SyncCard />

      <Card>
        <h2 className="font-semibold">Backup</h2>
        <p className="mt-1 text-sm text-muted">
          Everything is stored on this device first. Export a JSON copy of all your data as a backup that does not depend on any online service.
        </p>
        <Button className="mt-3 w-full" onClick={exportJson}>
          Export data
        </Button>
        {message && <p className="mt-2 text-sm text-accent">{message}</p>}
      </Card>

      <Card>
        <h2 className="font-semibold">Storage</h2>
        <p className="mt-1 text-sm text-muted">
          {persisted === 'yes' && 'Persistent: the browser will not clear this data under storage pressure.'}
          {persisted === 'no' && 'Not persistent: the browser may clear this data if the device runs low on space.'}
          {persisted === 'unsupported' && 'This browser does not report storage persistence.'}
          {persisted === 'unknown' && 'Checking…'}
        </p>
        {persisted === 'no' && (
          <Button className="mt-3 w-full" onClick={requestPersist}>
            Request persistent storage
          </Button>
        )}
      </Card>

      <p className="text-center text-xs text-muted">Calorie Tracker · milestone 5</p>
    </div>
  )
}
