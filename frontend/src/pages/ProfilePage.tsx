import { useRef, useState } from "react"
import { api } from "@/lib/api"
import { useAuth } from "@/App"
import { useSettings } from "@/contexts/SettingsContext"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PasswordInput } from "@/components/ui/password-input"
import { Separator } from "@/components/ui/separator"
import UserAvatar from "@/components/UserAvatar"
import { Loader2, Camera, X } from "lucide-react"

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

export default function ProfilePage() {
  const { user, setUser } = useAuth()
  const { appSettings } = useSettings()

  const [username, setUsername] = useState(user.username)
  const [displayName, setDisplayName] = useState(user.displayName)
  const [birthday, setBirthday] = useState(user.birthday ?? "")
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState("")
  const [profileSuccess, setProfileSuccess] = useState(false)

  const [prefCurrency, setPrefCurrency] = useState(user.currency ?? "")
  const [prefLocale, setPrefLocale] = useState(user.locale ?? "")
  const [prefLoading, setPrefLoading] = useState(false)
  const [prefSuccess, setPrefSuccess] = useState(false)

  const [avatarUploading, setAvatarUploading] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordError, setPasswordError] = useState("")
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarUploading(true)
    try {
      const url = await api.upload(file)
      const { user: updated } = await api.profile.update({
        username: user.username,
        displayName: user.displayName,
        birthday: user.birthday ?? "",
        currency: user.currency ?? "",
        locale: user.locale ?? "",
        avatarUrl: url,
      })
      setUser(updated)
    } finally {
      setAvatarUploading(false)
      if (avatarInputRef.current) avatarInputRef.current.value = ""
    }
  }

  async function handleRemoveAvatar() {
    const { user: updated } = await api.profile.update({
      username: user.username,
      displayName: user.displayName,
      birthday: user.birthday ?? "",
      currency: user.currency ?? "",
      locale: user.locale ?? "",
      avatarUrl: "",
    })
    setUser(updated)
  }

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault()
    setProfileError("")
    setProfileSuccess(false)
    setProfileLoading(true)
    try {
      const { user: updated } = await api.profile.update({
        username,
        displayName,
        birthday,
        currency: prefCurrency,
        locale: prefLocale,
        avatarUrl: user.avatarUrl ?? "",
      })
      setUser(updated)
      setProfileSuccess(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong."
      setProfileError(msg)
    } finally {
      setProfileLoading(false)
    }
  }

  async function handlePrefSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPrefLoading(true)
    try {
      const { user: updated } = await api.profile.update({
        username: user.username,
        displayName: user.displayName,
        birthday: user.birthday ?? "",
        currency: prefCurrency,
        locale: prefLocale,
        avatarUrl: user.avatarUrl ?? "",
      })
      setUser(updated)
      setPrefSuccess(true)
      setTimeout(() => setPrefSuccess(false), 2000)
    } finally {
      setPrefLoading(false)
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPasswordError("")
    setPasswordSuccess(false)
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.")
      return
    }
    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters.")
      return
    }
    setPasswordLoading(true)
    try {
      await api.profile.updatePassword(currentPassword, newPassword)
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setPasswordSuccess(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong."
      setPasswordError(msg)
    } finally {
      setPasswordLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6 animate-in fade-in duration-200">
      <h1 className="text-2xl font-bold">Profile</h1>

      <div className="flex items-center gap-4">
        <div className="relative">
          <UserAvatar user={user} className="w-20 h-20 text-2xl" />
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            disabled={avatarUploading}
            className="absolute inset-0 rounded-full flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity disabled:opacity-50 cursor-pointer"
          >
            {avatarUploading ? (
              <Loader2 size={20} className="text-white animate-spin" />
            ) : (
              <Camera size={20} className="text-white" />
            )}
          </button>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />
        </div>
        <div className="min-w-0 space-y-1">
          <p className="font-semibold truncate">{user.displayName}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => avatarInputRef.current?.click()} disabled={avatarUploading}>
              Change photo
            </Button>
            {user.avatarUrl && (
              <Button variant="ghost" size="sm" onClick={handleRemoveAvatar} className="text-muted-foreground gap-1">
                <X size={13} />
                Remove
              </Button>
            )}
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="p-display">Display name</Label>
              <Input
                id="p-display"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-username">Username</Label>
              <Input
                id="p-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-birthday">Birthday</Label>
              <Input
                id="p-birthday"
                type="date"
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
              />
            </div>
            {profileError && <p className="text-sm text-destructive">{profileError}</p>}
            {profileSuccess && <p className="text-sm text-green-600">Saved.</p>}
            <Button type="submit" disabled={profileLoading} >
              {profileLoading && <Loader2 className="animate-spin" />}
              Save changes
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Display preferences</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePrefSubmit} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Override the app-wide defaults (currently {appSettings.currency} / {appSettings.locale}). Leave empty to use the app default.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="pref-currency">Currency</Label>
                <Input
                  id="pref-currency"
                  value={prefCurrency}
                  onChange={(e) => setPrefCurrency(e.target.value.toUpperCase())}
                  placeholder={`e.g. ${appSettings.currency}`}
                  maxLength={3}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pref-locale">Locale</Label>
                <select
                  id="pref-locale"
                  value={prefLocale}
                  onChange={(e) => setPrefLocale(e.target.value)}
                  className={selectClass}
                >
                  <option value="">App default</option>
                  {LOCALE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
            {prefSuccess && <p className="text-sm text-green-600">Saved.</p>}
            <Button type="submit" disabled={prefLoading} >
              {prefLoading && <Loader2 className="animate-spin" />}
              Save preferences
            </Button>
          </form>
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Change password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="p-current">Current password</Label>
              <PasswordInput
                id="p-current"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-new">New password</Label>
              <PasswordInput
                id="p-new"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-confirm">Confirm new password</Label>
              <PasswordInput
                id="p-confirm"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}
            {passwordSuccess && <p className="text-sm text-green-600">Password updated.</p>}
            <Button type="submit" disabled={passwordLoading} >
              {passwordLoading && <Loader2 className="animate-spin" />}
              Update password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
