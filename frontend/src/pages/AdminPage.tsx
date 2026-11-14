import { useEffect, useRef, useState } from "react"
import { api, type User } from "@/lib/api"
import { useAuth } from "@/App"
import { useSettings } from "@/contexts/SettingsContext"
import { CURRENCIES } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import UserAvatar from "@/components/UserAvatar"
import { HintIcon } from "@/components/HintIcon"
import { useToast } from "@/components/Toaster"
import { Loader2, Plus, Trash2, KeyRound, Link2, Copy, Check, MoreHorizontal, Share } from "lucide-react"

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"

const LOCALE_OPTIONS = [
  { value: "lt-LT", label: "Lithuanian" },
  { value: "en-US", label: "English (US)" },
  { value: "en-GB", label: "English (UK)" },
  { value: "de-DE", label: "German" },
  { value: "fr-FR", label: "French" },
  { value: "pl-PL", label: "Polish" },
]

// A sample price, so each option shows what it actually changes.
function samplePrice(locale: string, currency: string) {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(1234.5)
  } catch {
    return ""
  }
}

function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error && err.message ? err.message : fallback
}

function DefaultsSection() {
  const { appSettings, refreshSettings } = useSettings()
  const toast = useToast()
  const [currency, setCurrency] = useState(appSettings.currency)
  const [locale, setLocale] = useState(appSettings.locale)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setCurrency(appSettings.currency)
    setLocale(appSettings.locale)
  }, [appSettings.currency, appSettings.locale])

  const dirty = currency !== appSettings.currency || locale !== appSettings.locale
  // Keep a currency that was saved before the list existed selectable.
  const currencies = CURRENCIES.includes(currency) ? CURRENCIES : [currency, ...CURRENCIES]

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await api.settings.update({ currency, locale })
      refreshSettings()
      toast({ message: "Defaults saved" })
    } catch (err) {
      toast({ variant: "error", message: errorMessage(err, "Couldn't save the defaults. Try again.") })
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-1.5 text-lg font-semibold">
        Defaults
        <HintIcon label="About defaults">
          Used for anyone who hasn't picked their own currency or price format in their profile.
        </HintIcon>
      </h2>
      <Card className="p-4">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="as-currency">Currency</Label>
              <select id="as-currency" value={currency} onChange={(e) => setCurrency(e.target.value)} className={selectClass}>
                {currencies.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="as-locale">Price format</Label>
              <select id="as-locale" value={locale} onChange={(e) => setLocale(e.target.value)} className={selectClass}>
                {LOCALE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label} ({samplePrice(o.value, currency)})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={loading || !dirty} className="w-full sm:w-auto">
              {loading && <Loader2 className="animate-spin" />}
              Save
            </Button>
          </div>
        </form>
      </Card>
    </section>
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
    } catch (err) {
      setError(errorMessage(err, "Something went wrong."))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a person</DialogTitle>
          <DialogDescription>
            You'll need to give them their username and password. To let them pick their own, send an invite link instead.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cu-display">Name</Label>
            <Input id="cu-display" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cu-username">Username</Label>
              <Input id="cu-username" value={username} onChange={(e) => setUsername(e.target.value)} required autoCapitalize="none" autoCorrect="off" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cu-password">Password</Label>
              <PasswordInput id="cu-password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cu-birthday">Birthday (optional)</Label>
            <Input id="cu-birthday" type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5">
            <Label htmlFor="cu-admin" className="flex items-center gap-1.5">
              Admin
              <HintIcon label="About admins">Admins can add and remove people, reset passwords and change the defaults.</HintIcon>
            </Label>
            <Switch id="cu-admin" checked={isAdmin} onCheckedChange={setIsAdmin} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="animate-spin" />}
              Add
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ResetPasswordDialog({
  user,
  onOpenChange,
  onDone,
}: {
  user: User | null
  onOpenChange: (v: boolean) => void
  onDone: (u: User) => void
}) {
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (user) { setPassword(""); setError("") }
  }, [user])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setError("")
    setLoading(true)
    try {
      await api.admin.updatePassword(user.id, password)
      onDone(user)
      onOpenChange(false)
    } catch (err) {
      setError(errorMessage(err, "Something went wrong."))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={!!user} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Reset {user?.displayName}'s password</DialogTitle>
          <DialogDescription>They'll use this new password next time they log in.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rp-password">New password</Label>
            <PasswordInput id="rp-password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="animate-spin" />}
              Reset password
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function InviteLinkDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [link, setLink] = useState("")
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState("")
  const requested = useRef(false)
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function"

  async function generate() {
    setLoading(true)
    setError("")
    try {
      const { token } = await api.admin.createSignupLink()
      setLink(`${window.location.origin}/signup/${token}`)
    } catch {
      setError("Couldn't make a link. Try again.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Opening the dialog is the request, so make the link right away. The ref
    // stops a second link being made if the effect runs twice.
    if (open && !requested.current) {
      requested.current = true
      generate()
    }
    if (!open) {
      requested.current = false
      setLink("")
      setCopied(false)
      setError("")
    }
  }, [open])

  async function copy() {
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function share() {
    try {
      await navigator.share({ title: "Join Munus", url: link })
    } catch {
      // Closing the share sheet counts as an error; nothing to do.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite someone</DialogTitle>
          <DialogDescription>
            Send this link to one person. They pick their own name and password. It works once and expires in 7 days.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <div className="space-y-3">
            <p className="text-sm text-destructive">{error}</p>
            <Button onClick={generate} disabled={loading} className="w-full">
              {loading && <Loader2 className="animate-spin" />}
              Try again
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <Input value={loading ? "Making a link…" : link} readOnly className="text-xs" onFocus={(e) => e.currentTarget.select()} />
            <div className="flex gap-2">
              <Button onClick={copy} disabled={!link} className="flex-1">
                {copied ? <Check /> : <Copy />}
                {copied ? "Copied" : "Copy link"}
              </Button>
              {canShare && (
                <Button variant="outline" onClick={share} disabled={!link} className="flex-1">
                  <Share />
                  Share
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function PersonRow({
  user: u,
  isSelf,
  onReset,
  onDelete,
}: {
  user: User
  isSelf: boolean
  onReset: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <UserAvatar user={u} className="w-9 h-9 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <p className="font-medium leading-tight truncate">{u.displayName}</p>
          {u.isAdmin && <Badge variant="secondary" className="shrink-0 px-1.5 py-0 text-[11px]">Admin</Badge>}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">@{u.username}</p>
      </div>
      {/* modal={false} so a dialog opened from the menu doesn't leave the page unclickable. */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground">
            <MoreHorizontal />
            <span className="sr-only">Options for {u.displayName}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onReset}>
            <KeyRound size={15} />
            Reset password
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={onDelete}
            disabled={isSelf}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 size={15} />
            {isSelf ? "You can't delete yourself" : "Delete"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export default function AdminPage() {
  const { user: currentUser } = useAuth()
  const toast = useToast()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [resetTarget, setResetTarget] = useState<User | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)

  useEffect(() => {
    api.users.list().then(setUsers).finally(() => setLoading(false))
  }, [])

  function sorted(list: User[]) {
    return [...list].sort((a, b) => a.displayName.localeCompare(b.displayName))
  }

  async function handleDelete(target: User) {
    const before = users
    setUsers((prev) => prev.filter((u) => u.id !== target.id))
    try {
      await api.admin.deleteUser(target.id)
      toast({ message: `Deleted ${target.displayName}` })
    } catch (err) {
      setUsers(before)
      toast({ variant: "error", message: errorMessage(err, `Couldn't delete ${target.displayName}. Try again.`) })
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-8 animate-in fade-in duration-200">
      <h1 className="text-2xl font-bold">Admin</h1>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">
            People{!loading && <span className="text-muted-foreground font-normal"> ({users.length})</span>}
          </h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setInviteOpen(true)}>
              <Link2 />
              Invite link
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus />
              Add
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="h-48 rounded-xl bg-muted animate-pulse" />
        ) : (
          <Card className="divide-y overflow-hidden">
            {users.map((u) => (
              <PersonRow
                key={u.id}
                user={u}
                isSelf={u.id === currentUser.id}
                onReset={() => setResetTarget(u)}
                onDelete={() => setDeleteTarget(u)}
              />
            ))}
          </Card>
        )}
      </section>

      <DefaultsSection />

      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(u) => {
          setUsers((prev) => sorted([...prev, u]))
          toast({ message: `Added ${u.displayName}` })
        }}
      />

      <InviteLinkDialog open={inviteOpen} onOpenChange={setInviteOpen} />

      <ResetPasswordDialog
        user={resetTarget}
        onOpenChange={(v) => { if (!v) setResetTarget(null) }}
        onDone={(u) => toast({ message: `Password reset for ${u.displayName}` })}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.displayName}?</AlertDialogTitle>
            <AlertDialogDescription>
              Their account and gift list will be removed and they'll be logged out. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
