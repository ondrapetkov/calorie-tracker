import { useState } from 'react'
import { Button, inputCls } from '../../components/ui'
import { repo, TagNameTakenError } from '../../db/repo'
import { FALLBACK_GROUP_ID } from '../../data/builtinTags'
import type { GroupInfo, TagInfo } from '../../domain/tags'
import { TagPicker } from './TagPicker'
import { useVocabulary } from './useVocabulary'

type Editing =
  | { kind: 'tag'; tag: TagInfo; name: string }
  | { kind: 'group'; group: GroupInfo; name: string }
  | { kind: 'delete-group'; group: GroupInfo; moveTo: string }

/** Every group with its tags. The owner's own tags and groups can be renamed and deleted. */
export function TagsManager() {
  const vocab = useVocabulary()
  const [editing, setEditing] = useState<Editing | null>(null)
  const [newGroup, setNewGroup] = useState('')
  const [creatingTag, setCreatingTag] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!vocab) return null

  const run = async (action: () => Promise<void>, done: string) => {
    setError(null)
    setMessage(null)
    try {
      await action()
      setEditing(null)
      setMessage(done)
    } catch (e) {
      if (e instanceof TagNameTakenError) {
        const existing = vocab.byId.get(e.existingId) ?? vocab.groups.find((g) => g.id === e.existingId)
        setError(`Already exists as "${existing?.name ?? 'another name'}".`)
      } else setError(e instanceof Error ? e.message : String(e))
    }
  }

  const deleteTag = (t: TagInfo) => {
    if (!window.confirm(`Delete "${t.name}"? It will be removed from every meal and food.`)) return
    void run(() => repo.deleteTag(t.id), `Deleted "${t.name}".`)
  }

  const renameForm = (value: string, onChange: (v: string) => void, onSave: () => void) => (
    <div className="flex gap-2 py-2">
      <input
        className={inputCls}
        value={value}
        autoFocus
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onSave()}
      />
      <Button variant="primary" onClick={onSave}>
        Save
      </Button>
      <Button variant="ghost" onClick={() => setEditing(null)}>
        Cancel
      </Button>
    </div>
  )

  const small = 'px-2 py-1 text-sm'

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">
        Built-in tags are fixed. Your own tags and groups can be renamed or deleted; every meal and food that uses them
        follows.
      </p>
      {message && <p className="text-sm text-accent">{message}</p>}
      {error && <p className="text-sm text-danger">{error}</p>}

      {vocab.groups.map((g) => (
        <section key={g.id}>
          {editing?.kind === 'group' && editing.group.id === g.id ? (
            renameForm(
              editing.name,
              (name) => setEditing({ ...editing, name }),
              () => run(() => repo.renameTagGroup(g.id, editing.name), 'Group renamed.'),
            )
          ) : (
            <div className="mb-1 flex items-center gap-2">
              <h3 className="flex flex-1 items-center gap-2 text-sm font-semibold">
                <span className="text-lg leading-none" aria-hidden="true">
                  {g.icon}
                </span>
                {g.name}
              </h3>
              {!g.builtin && (
                <>
                  <Button variant="ghost" className={small} onClick={() => setEditing({ kind: 'group', group: g, name: g.name })}>
                    Rename
                  </Button>
                  <Button
                    variant="ghost"
                    className={`${small} !text-danger`}
                    onClick={() => setEditing({ kind: 'delete-group', group: g, moveTo: FALLBACK_GROUP_ID })}
                  >
                    Delete
                  </Button>
                </>
              )}
            </div>
          )}

          {editing?.kind === 'delete-group' && editing.group.id === g.id && (
            <div className="mb-2 space-y-2 rounded-lg border border-line-strong p-3">
              <p className="text-sm">Delete "{g.name}"? Move its tags to:</p>
              <select
                aria-label="Move tags to"
                className={inputCls}
                value={editing.moveTo}
                onChange={(e) => setEditing({ ...editing, moveTo: e.target.value })}
              >
                {vocab.groups
                  .filter((x) => x.id !== g.id)
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
              </select>
              <div className="flex gap-2">
                <Button
                  variant="danger"
                  onClick={() => run(() => repo.deleteTagGroup(g.id, editing.moveTo), `Deleted "${g.name}".`)}
                >
                  Delete group
                </Button>
                <Button variant="ghost" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {g.tags.length === 0 && <p className="py-1 text-sm text-muted">No tags in this group.</p>}
          {g.tags.map((t) =>
            editing?.kind === 'tag' && editing.tag.id === t.id ? (
              <div key={t.id}>
                {renameForm(
                  editing.name,
                  (name) => setEditing({ ...editing, name }),
                  () => run(() => repo.renameTag(t.id, editing.name), 'Tag renamed.'),
                )}
              </div>
            ) : (
              <div key={t.id} className="flex items-center gap-2 border-b border-line py-1.5 last:border-0">
                <span className="w-6 shrink-0 text-center leading-none" aria-hidden="true">
                  {t.icon}
                </span>
                <span className={`flex-1 truncate ${t.builtin ? 'text-muted' : ''}`}>{t.name}</span>
                {!t.builtin && (
                  <>
                    <Button variant="ghost" className={small} onClick={() => setEditing({ kind: 'tag', tag: t, name: t.name })}>
                      Rename
                    </Button>
                    <Button variant="ghost" className={`${small} !text-danger`} onClick={() => deleteTag(t)}>
                      Delete
                    </Button>
                  </>
                )}
              </div>
            ),
          )}
        </section>
      ))}

      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">New group</h3>
        <div className="flex gap-2">
          <input className={inputCls} placeholder="Group name" value={newGroup} onChange={(e) => setNewGroup(e.target.value)} />
          <Button
            disabled={!newGroup.trim()}
            onClick={() =>
              run(async () => {
                await repo.createTagGroup(newGroup)
                setNewGroup('')
              }, 'Group created.')
            }
          >
            Create
          </Button>
        </div>
        <Button className="w-full" onClick={() => setCreatingTag(true)}>
          New tag
        </Button>
      </section>

      {creatingTag && (
        <TagPicker
          title="New tag"
          selected={[]}
          onToggle={() => setCreatingTag(false)}
          onClose={() => setCreatingTag(false)}
        />
      )}
    </div>
  )
}
