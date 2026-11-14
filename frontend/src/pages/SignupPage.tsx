import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { api, type User } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PasswordInput } from "@/components/ui/password-input"
import UserAvatar from "@/components/UserAvatar"
import AvatarPicker from "@/components/AvatarPicker"
import { AVATAR_SHAPE, randomPresetUrl } from "@/lib/avatars"
import { cn } from "@/lib/utils"
import { Loader2, Pencil } from "lucide-react"
import { MunusLogo } from "@/components/MunusLogo"

interface Props {
  onSignup: (user: User) => void
}

export default function SignupPage({ onSignup }: Props) {
  const { token } = useParams<{ token: string }>()
  const [valid, setValid] = useState<boolean | null>(null)
  const [username, setUsername] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  // Starts on a random animal; picking one or a photo replaces it. Whatever is
  // shown gets saved with the account.
  const [avatarUrl, setAvatarUrl] = useState(randomPresetUrl)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!token) { setValid(false); return }
    api.auth.validateSignupToken(token)
      .then(() => setValid(true))
      .catch(() => setValid(false))
  }, [token])

  function pickPreset(url: string) {
    setAvatarFile(null)
    setAvatarUrl(url)
  }

  function pickPhoto(file: File) {
    // The photo is uploaded once the account exists, so show a local preview until then.
    setAvatarFile(file)
    setAvatarUrl(URL.createObjectURL(file))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (password !== confirm) {
      setError("Passwords do not match.")
      return
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.")
      return
    }
    setLoading(true)
    try {
      const { user: newUser } = await api.auth.signup(token!, { username, displayName, password })
      try {
        const url = avatarFile ? await api.upload(avatarFile) : avatarUrl
        const { user: updated } = await api.profile.update({
          username: newUser.username,
          displayName: newUser.displayName,
          birthday: newUser.birthday ?? "",
          currency: newUser.currency ?? "",
          locale: newUser.locale ?? "",
          avatarUrl: url,
        })
        onSignup(updated)
      } catch {
        // The account exists either way; they keep the default picture and can change it in Profile.
        onSignup(newUser)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong."
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  if (valid === null) return null

  if (!valid) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-8">
        <Card className="max-w-sm w-full mx-auto">
          <CardHeader className="text-center">
            <h1>
              <MunusLogo className="h-8 mx-auto" />
            </h1>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground">This signup link is invalid or has already been used.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const previewUser = { displayName: displayName || "?", avatarUrl }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-background">
      <Card className="max-w-sm w-full mx-auto">
        <CardHeader className="text-center pb-2">
          <h1>
            <MunusLogo stacked className="h-24 mx-auto" />
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Create your account</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className={cn(AVATAR_SHAPE, "relative outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2")}
              >
                <UserAvatar user={previewUser} className="w-20 h-20" />
                <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border bg-background text-foreground shadow-sm">
                  <Pencil size={13} />
                </span>
                <span className="sr-only">Choose a picture</span>
              </button>
            </div>
            {avatarFile && (
              <p className="text-xs text-center text-muted-foreground -mt-2">
                Photo will be uploaded when you create your account
              </p>
            )}
            <AvatarPicker
              open={pickerOpen}
              onOpenChange={setPickerOpen}
              value={avatarUrl}
              onPick={pickPreset}
              onUpload={pickPhoto}
            />

            <div className="space-y-1.5">
              <Label htmlFor="su-display">Display name</Label>
              <Input
                id="su-display"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="How others will see you"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="su-username">Username</Label>
              <Input
                id="su-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="username"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="su-password">Password</Label>
              <PasswordInput
                id="su-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="su-confirm">Confirm password</Label>
              <PasswordInput
                id="su-confirm"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="animate-spin" />}
              Create account
            </Button>
            {error && <p className="text-sm text-destructive text-center">{error}</p>}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
