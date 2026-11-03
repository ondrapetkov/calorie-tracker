import { useState } from 'react'
import { Button, Sheet, inputCls } from '../../components/ui'
import { repo, TagNameTakenError } from '../../db/repo'
import { findTagByName, searchTags, type TagInfo } from '../../domain/tags'
import { useVocabulary } from './useVocabulary'

interface Props {
  title: string
  selected: string[]
  /** Called for a tapped tag, and for a newly created one. The picker stays open. */
  onToggle: (tagId: string) => void
  onClose: () => void
}

/**
 * Full-screen tag picker: one search box across all groups, the grouped list when the search is
 * empty, and "Create '…'" when nothing has that name. Creating asks which group the tag belongs to.
 */
export function TagPicker({ title, selected, onToggle, onClose }: Props) {
  const vocab = useVocabulary()
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState<string | null>(null)
  const [newGroup, setNewGroup] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const trimmed = query.trim()
  const hits = vocab && trimmed ? searchTags(vocab, trimmed) : []
  const exact = vocab && trimmed ? findTagByName(vocab, trimmed) : undefined

  const pick = (t: TagInfo) => {
    setMessage(null)
    onToggle(t.id)
  }

  const create = async (groupId: string | null) => {
    if (!creating || busy) return
    setBusy(true)
    setMessage(null)
    try {
      let target = groupId
      if (target === null) {
        try {
          target = (await repo.createTagGroup(newGroup)).id
        } catch (e) {
          if (e instanceof TagNameTakenError) target = e.existingId
          else throw e
        }
      }
      const tag = await repo.createTag(creating, target)
      if (!selected.includes(tag.id)) onToggle(tag.id)
      setCreating(null)
      setNewGroup('')
      setQuery('')
    } catch (e) {
      if (e instanceof TagNameTakenError) {
        const existing = vocab?.byId.get(e.existingId)
        if (existing && !selected.includes(existing.id)) onToggle(existing.id)
        setMessage(`Already exists as "${existing?.name ?? creating}".`)
        setCreating(null)
      } else {
        setMessage(e instanceof Error ? e.message : String(e))
      }
    } finally {
      setBusy(false)
    }
  }

  const row = (t: TagInfo, showGroup = false) => {
    const on = selected.includes(t.id)
    return (
      <button
        key={t.id}
        type="button"
        aria-pressed={on}
        onClick={() => pick(t)}
        className="flex w-full items-center gap-3 border-b border-line px-3 py-2.5 text-left last:border-0 active:bg-surface-2"
      >
        <span className="w-6 shrink-0 text-center text-lg leading-none" aria-hidden="true">
          {t.icon}
        </span>
        <span className="min-w-0 flex-1 truncate">
          {t.name}
          {showGroup && vocab && (
            <span className="ml-2 text-xs text-muted">{vocab.groups.find((g) => g.id === t.groupId)?.name}</span>
          )}
        </span>
        <span className={`text-lg ${on ? 'text-accent' : 'text-transparent'}`} aria-hidden="true">
          ✓
        </span>
      </button>
    )
  }

  if (creating !== null && vocab)
    return (
      <Sheet title={`New tag "${creating}"`} onBack={() => setCreating(null)} onClose={onClose}>
        <div className="space-y-4">
          <p className="text-sm text-muted">Which group does it belong to?</p>
          <div>
            {vocab.groups.map((g) => (
              <button
                key={g.id}
                type="button"
                disabled={busy}
                onClick={() => create(g.id)}
                className="flex w-full items-center gap-3 border-b border-line py-2.5 text-left last:border-0 active:bg-surface-2"
              >
                <span className="w-6 text-center text-lg leading-none" aria-hidden="true">
                  {g.icon}
                </span>
                {g.name}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Or a new group</h3>
            <div className="flex gap-2">
              <input
                className={inputCls}
                placeholder="Group name"
                value={newGroup}
                onChange={(e) => setNewGroup(e.target.value)}
              />
              <Button disabled={busy || !newGroup.trim()} onClick={() => create(null)}>
                Create
              </Button>
            </div>
          </div>
          {message && <p className="text-sm text-danger">{message}</p>}
        </div>
      </Sheet>
    )

  return (
    <Sheet title={title} onClose={onClose}>
      <div className="space-y-4">
        <input
          className={inputCls}
          type="search"
          placeholder="Search tags"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setMessage(null)
          }}
        />
        {message && <p className="text-sm text-accent">{message}</p>}
        {!vocab ? null : trimmed ? (
          <div className="overflow-hidden rounded-xl border border-line-strong bg-surface">
            {hits.map((t) => row(t, true))}
            {!exact && (
              <button
                type="button"
                onClick={() => setCreating(trimmed)}
                className="flex w-full items-center border-b border-line px-3 py-2.5 text-left text-accent last:border-0 active:bg-surface-2"
              >
                Create "{trimmed}"
              </button>
            )}
          </div>
        ) : (
          vocab.groups.map((g) =>
            g.tags.length === 0 ? null : (
              <section key={g.id} className="overflow-hidden rounded-xl border border-line-strong bg-surface">
                <h3 className="flex items-center gap-2 border-b border-line-strong bg-surface-2 px-3 py-2 text-sm font-semibold">
                  <span className="text-lg leading-none" aria-hidden="true">
                    {g.icon}
                  </span>
                  {g.name}
                </h3>
                {g.tags.map((t) => row(t))}
              </section>
            ),
          )
        )}
        <Button variant="primary" className="w-full" onClick={onClose}>
          Done
        </Button>
      </div>
    </Sheet>
  )
}
