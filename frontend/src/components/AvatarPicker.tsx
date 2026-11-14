import { useRef, useState } from "react"
import { Camera, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AVATAR_SHAPE, PRESET_AVATARS, isPresetUrl, presetLabel, presetUrl } from "@/lib/avatars"
import { cn } from "@/lib/utils"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The picture in use now: a preset, an uploaded photo, or a local preview. */
  value: string
  onPick: (url: string) => void | Promise<void>
  onUpload: (file: File) => void | Promise<void>
}

const tile = cn(
  AVATAR_SHAPE,
  "relative aspect-square overflow-hidden outline-none transition-transform",
  "hover:scale-[1.04] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
  "disabled:pointer-events-none"
)
const selected = "ring-2 ring-foreground ring-offset-2"

// Grid of the preset illustrations plus an upload tile. Picking one closes
// the dialog; the caller decides whether that saves right away (Profile) or
// later (Signup).
export default function AvatarPicker({ open, onOpenChange, value, onPick, onUpload }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState("")
  const hasPhoto = !!value && !isPresetUrl(value)

  async function run(key: string, fn: () => void | Promise<void>) {
    setBusy(key)
    setError("")
    try {
      await fn()
      onOpenChange(false)
    } catch {
      setError(key === "upload" ? "That photo couldn't be uploaded. Try another one." : "Couldn't save that. Try again.")
    } finally {
      setBusy(null)
    }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // Lets the same file be picked again later.
    e.target.value = ""
    if (file) run("upload", () => onUpload(file))
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Choose a picture</DialogTitle>
          <DialogDescription>Pick an animal, or upload a photo of your own.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-5 sm:grid-cols-6 gap-2.5 sm:gap-3 p-1">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={!!busy}
            className={cn(
              tile,
              "flex flex-col items-center justify-center gap-1 border-2 border-dashed border-input text-muted-foreground hover:border-ring hover:text-foreground"
            )}
          >
            {busy === "upload" ? <Loader2 size={20} className="animate-spin" /> : <Camera size={20} />}
            <span className="text-[11px] font-medium leading-none">Upload</span>
          </button>

          {hasPhoto && (
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={!!busy}
              aria-label="Your photo"
              aria-pressed
              className={cn(tile, selected)}
            >
              <img src={value} alt="" className="h-full w-full object-cover" />
            </button>
          )}

          {PRESET_AVATARS.map((name) => {
            const url = presetUrl(name)
            const active = url === value
            return (
              <button
                key={name}
                type="button"
                onClick={() => (active ? onOpenChange(false) : run(name, () => onPick(url)))}
                disabled={!!busy}
                aria-label={presetLabel(name)}
                aria-pressed={active}
                title={presetLabel(name)}
                className={cn(tile, active && selected)}
              >
                <img src={url} alt="" className="h-full w-full" />
                {busy === name && (
                  <span className="absolute inset-0 flex items-center justify-center bg-background/60">
                    <Loader2 size={18} className="animate-spin" />
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </DialogContent>
    </Dialog>
  )
}
