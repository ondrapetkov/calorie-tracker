import { useEffect, useState } from 'react'
import { Button, Card, Field, inputCls } from '../../components/ui'
import { timeAgo } from '../../domain/time'
import { getSyncManager, useSyncStatus } from '../../sync'
import type { SyncStatus } from '../../sync/manager'

function statusLine(s: SyncStatus, now: number): string {
  if (s.phase === 'syncing') return 'Syncing…'
  if (s.phase === 'error') return s.pending > 0 ? `${s.pending} change${s.pending === 1 ? '' : 's'} waiting to upload` : 'Sync failed'
  if (s.pending > 0) return `${s.pending} change${s.pending === 1 ? '' : 's'} waiting to upload`
  return s.lastSyncAt ? `Up to date · synced ${timeAgo(s.lastSyncAt, now)}` : 'Not synced yet'
}

export function SyncCard() {
  const status = useSyncStatus()
  const manager = getSyncManager()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(Date.now)

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) return setError('Enter your email and password.')
    setBusy(true)
    setError(null)
    try {
      await manager.signIn(email, password)
      setPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  if (status.phase === 'signed-out') {
    return (
      <Card>
        <h2 className="font-semibold">Sync</h2>
        <p className="mt-1 text-sm text-muted">
          Sign in to keep your data in sync between devices. Everything keeps working offline, and nothing is uploaded
          until you sign in.
        </p>
        {status.error && <p className="mt-2 text-sm text-danger">{status.error}</p>}
        <form onSubmit={signIn} className="mt-3 space-y-3">
          <Field label="Email">
            <input
              className={inputCls}
              type="email"
              autoComplete="username"
              inputMode="email"
              autoCapitalize="none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="Password">
            <input
              className={inputCls}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" variant="primary" className="w-full" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </Card>
    )
  }

  return (
    <Card>
      <h2 className="font-semibold">Sync</h2>
      <p className="mt-1 text-sm text-muted">Signed in as {status.email ?? 'your account'}</p>
      <p className={`mt-2 text-sm ${status.phase === 'error' ? 'text-danger' : ''}`} role="status">
        {statusLine(status, now)}
      </p>
      {status.phase === 'error' && status.error && <p className="mt-1 text-sm text-danger">{status.error}</p>}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button onClick={() => void manager.syncNow()} disabled={status.phase === 'syncing'}>
          Sync now
        </Button>
        <Button variant="danger" onClick={() => void manager.signOut()}>
          Sign out
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted">Signing out keeps your data on this device and stops syncing.</p>
    </Card>
  )
}
