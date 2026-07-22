import { useEffect, useState } from "react"
import { api, type User } from "@/lib/api"
import { useAuth } from "@/App"
import { useSettings } from "@/contexts/SettingsContext"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import UserAvatar from "@/components/UserAvatar"
import { Loader2, Plus, Trash2, KeyRound, Link, Copy, Check } from "lucide-react"

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"

const LOCALE_OPTIONS = [
  { value: "lt-LT", label: "Lithuanian (lt-LT)" },
  { value: "en-US", label: "English US (en-US)" },
  { value: "en-GB", label: "English UK (en-GB)" },
  { value: "de-DE", label: "German (de-DE)" },
  { value: "fr-FR", label: "French (fr-FR)" },
  { value: "pl-PL", label: "Polish (pl-PL)" },
]

function AppSettingsCard() {
  const { appSettings, refreshSettings } = useSettings()
  const [currency, setCurrency] = useState(appSettings.currency)
  const [locale, setLocale] = useState(appSettings.locale)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setCurrency(appSettings.currency)
    setLocale(appSettings.locale)
  }, [appSettings.currency, appSettings.locale])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await api.settings.update({ currency, locale })
      refreshSettings()
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-base">App settings</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="as-currency">Default currency</Label>
              <Input
                id="as-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                placeholder="EUR"
                maxLength={3}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="as-locale">Default locale</Label>
              <select
                id="as-locale"
                value={locale}
                onChange={(e) => setLocale(e.target.value)}
                className={selectClass}
              >
                {LOCALE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
          <Button type="submit" size="sm" disabled={loading} className="gap-1.5 min-h-[36px]">
            {loading ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} className="text-green-600" /> : null}
            {saved ? "Saved!" : "Save settings"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function CreateUserDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: (u: User) => void
}) {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [birthday, setBirthday] = useState("")
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  function reset() {
    setUsername("")
    setPassword("")
    setDisplayName("")
    setBirthday("")
    setIsAdmin(false)
    setError("")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const user = await api.admin.createUser({ username, password, displayName, birthday, isAdmin })
      onCreated(user)
      onOpenChange(false)
      reset()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong."
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New user</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cu-username">Username</Label>
            <Input id="cu-username" value={username} onChange={(e) => setUsername(e.target.value)} required autoCapitalize="none" autoCorrect="off" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cu-password">Password</Label>
            <Input id="cu-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cu-display">Display name</Label>
            <Input id="cu-display" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cu-birthday">Birthday</Label>
            <Input id="cu-birthday" type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} />
          </div>
          <div className="flex items-center gap-3">
            <Switch id="cu-admin" checked={isAdmin} onCheckedChange={setIsAdmin} />
            <Label htmlFor="cu-admin">Admin</Label>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ResetPasswordDialog({
  user,
  open,
  onOpenChange,
}: {
  user: User
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      await api.admin.updatePassword(user.id, password)
      onOpenChange(false)
      setPassword("")
    } catch {
      setError("Something went wrong.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Reset password for {user.displayName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rp-password">New password</Label>
            <Input id="rp-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="animate-spin" />}
              Reset
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function SignupLinkDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [link, setLink] = useState("")
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) { setLink(""); setCopied(false); setError("") }
  }, [open])

  async function generate() {
    setLoading(true)
    setError("")
    try {
      const { token } = await api.admin.createSignupLink()
      setLink(`${window.location.origin}/signup/${token}`)
    } catch {
      setError("Could not generate link.")
    } finally {
      setLoading(false)
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Signup link</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Generate a one-time link. The recipient opens it to create their account. Expires in 7 days.
          </p>
          {!link ? (
            <>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button onClick={generate} disabled={loading} className="w-full min-h-[44px]">
                {loading && <Loader2 className="animate-spin" />}
                Generate link
              </Button>
            </>
          ) : (
            <div className="flex min-w-0 gap-2">
              <Input value={link} readOnly className="text-xs" />
              <Button variant="outline" size="icon" onClick={copy} className="shrink-0 min-h-[44px] min-w-[44px]">
                {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                <span className="sr-only">Copy</span>
              </Button>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function AdminPage() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [signupLinkOpen, setSignupLinkOpen] = useState(false)
  const [resetTarget, setResetTarget] = useState<User | null>(null)

  useEffect(() => {
    api.users.list().then(setUsers).finally(() => setLoading(false))
  }, [])

  function handleDelete(id: number) {
    setUsers((prev) => prev.filter((u) => u.id !== id))
    api.admin.deleteUser(id)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <AppSettingsCard />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Users</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setSignupLinkOpen(true)} className="min-h-[44px]">
            <Link size={18} />
            <span className="hidden sm:inline">Signup link</span>
          </Button>
          <Button onClick={() => setCreateOpen(true)} className="min-h-[44px]">
            <Plus size={18} />
            <span className="hidden sm:inline">New user</span>
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((n) => (
            <div key={n} className="h-20 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {users.map((u) => {
            const isSelf = u.id === currentUser.id
            return (
              <Card key={u.id}>
                <CardContent className="p-4 flex items-center gap-3">
                  <UserAvatar user={u} className="w-9 h-9 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="min-w-0 max-w-full truncate font-semibold">{u.displayName}</span>
                      {u.isAdmin && <Badge variant="secondary">Admin</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">@{u.username}</p>
                    {u.birthday && (
                      <p className="text-sm text-muted-foreground">{u.birthday}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setResetTarget(u)}
                      className="min-h-[44px] min-w-[44px]"
                      title="Reset password"
                    >
                      <KeyRound size={16} />
                      <span className="sr-only">Reset password</span>
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={isSelf}
                          className="min-h-[44px] min-w-[44px] text-destructive hover:text-destructive disabled:opacity-30"
                          title={isSelf ? "Cannot delete yourself" : "Delete user"}
                        >
                          <Trash2 size={16} />
                          <span className="sr-only">Delete</span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete {u.displayName}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete the user, their gift list, and all sessions.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(u.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(u) => setUsers((prev) => [...prev, u])}
      />

      <SignupLinkDialog open={signupLinkOpen} onOpenChange={setSignupLinkOpen} />

      {resetTarget && (
        <ResetPasswordDialog
          user={resetTarget}
          open={!!resetTarget}
          onOpenChange={(v) => { if (!v) setResetTarget(null) }}
        />
      )}
    </div>
  )
}
