import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { api, type ItemInput, type ItemView } from "@/lib/api"
import { CURRENCIES } from "@/lib/utils"
import { useSettings } from "@/contexts/SettingsContext"
import { Loader2, ImagePlus, X } from "lucide-react"
import SuggestionNote from "@/components/SuggestionNote"


/**
 * add: a new item on your own list.
 * edit: change one of your items.
 * suggest: propose an item for someone else's list.
 * accept: put a suggestion on your list, picking size or colour on the way.
 */
export type ItemFormMode = "add" | "edit" | "suggest" | "accept"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode?: ItemFormMode
  initial?: ItemView
  /** Prefills the link and fetches product details, e.g. from the share sheet. */
  initialUrl?: string
  /** The person a suggestion is for. */
  recipientName?: string
  onSave: (data: ItemInput, note: string) => Promise<void>
}

function isValidUrl(value: string) {
  try {
    const u = new URL(value)
    return u.protocol === "http:" || u.protocol === "https:"
  } catch {
    return false
  }
}

const titles: Record<ItemFormMode, string> = {
  add: "Add item",
  edit: "Edit item",
  suggest: "Suggest an idea",
  accept: "Add to your list",
}

const saveLabels: Record<ItemFormMode, string> = {
  add: "Save",
  edit: "Save",
  suggest: "Send suggestion",
  accept: "Add to my list",
}

export default function ItemFormDialog({
  open,
  onOpenChange,
  mode: modeProp,
  initial,
  initialUrl,
  recipientName,
  onSave,
}: Props) {
  const mode: ItemFormMode = modeProp ?? (initial ? "edit" : "add")
  const { currency: preferredCurrency } = useSettings()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [url, setUrl] = useState("")
  const [price, setPrice] = useState("")
  const [currency, setCurrency] = useState(preferredCurrency)
  const [imageUrl, setImageUrl] = useState("")
  const [details, setDetails] = useState("")
  const [note, setNote] = useState("")
  const [priority, setPriority] = useState(0)
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")
  const lastFetched = useRef("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const detailsRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "")
      setDescription(initial?.description ?? "")
      setUrl(initial?.url ?? "")
      setPrice(initial?.price ?? "")
      setCurrency(initial?.currency || preferredCurrency)
      setImageUrl(initial?.imageUrl ?? "")
      setDetails(initial?.details ?? "")
      setNote("")
      setPriority(initial?.priority ?? 0)
      setError("")
      lastFetched.current = initial?.url ?? ""
      if (!initial && initialUrl) {
        setUrl(initialUrl)
        fetchMeta(initialUrl)
      }
    }
    // fetchMeta only reads refs and setters, so it does not need to be a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial, initialUrl])

  async function fetchMeta(targetUrl: string) {
    if (!isValidUrl(targetUrl) || lastFetched.current === targetUrl) return
    lastFetched.current = targetUrl
    setFetching(true)
    try {
      // Product scraping is best-effort. Some shops block it, so failures stay quiet.
      const meta = await api.scrape(targetUrl)
      if (meta.name) setName((prev) => prev || meta.name)
      if (meta.description) setDescription((prev) => prev || meta.description)
      if (meta.price) setPrice((prev) => prev || meta.price)
      if (meta.image) setImageUrl((prev) => prev || meta.image)
    } catch {
      // silently ignore
    } finally {
      setFetching(false)
    }
  }

  function handleUrlPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text").trim()
    // Let the pasted value land in the input before reading metadata.
    if (isValidUrl(pasted)) setTimeout(() => fetchMeta(pasted), 0)
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const url = await api.upload(file)
      setImageUrl(url)
    } catch {
      setError("Image upload failed.")
    } finally {
      setUploading(false)
      // Allows uploading the same file again after removing it.
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError("Name is required.")
      return
    }
    setError("")
    setLoading(true)
    try {
      await onSave(
        { name: name.trim(), description, url, price, currency, imageUrl, details: details.trim(), priority },
        note.trim()
      )
      onOpenChange(false)
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        onOpenAutoFocus={(e) => {
          // When accepting a suggestion, the one thing left to fill in is the size or colour.
          if (mode === "accept") {
            e.preventDefault()
            detailsRef.current?.focus()
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {mode === "suggest" && recipientName ? `Suggest an idea for ${recipientName}` : titles[mode]}
          </DialogTitle>
          {mode === "suggest" && (
            <DialogDescription>
              Only {recipientName ?? "they"} will see this. If they like it, they add it to their list and pick the size or colour.
            </DialogDescription>
          )}
          {mode === "accept" && (
            <DialogDescription>
              Add your size, colour or anything else whoever buys it should know.
            </DialogDescription>
          )}
        </DialogHeader>

        {mode === "accept" && initial?.suggestedByName && (
          <SuggestionNote name={initial.suggestedByName} note={initial.suggestionNote} />
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="item-url">Link</Label>
            <div className="relative">
              <Input
                id="item-url"
                type="url"
                inputMode="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onPaste={handleUrlPaste}
                onBlur={() => fetchMeta(url)}
                placeholder="Paste a product link to fill in the rest"
                className={fetching ? "pr-8" : ""}
              />
              {fetching && (
                <Loader2
                  size={14}
                  className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground"
                />
              )}
            </div>
            {mode === "accept" && (
              <p className="text-xs text-muted-foreground">
                Swap in the link to the exact version you want, if the shop has one per size or colour.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="item-name">Name *</Label>
              <span className={`text-xs ${name.length >= 100 ? "text-destructive" : "text-muted-foreground"}`}>
                {name.length}/100
              </span>
            </div>
            <Input
              id="item-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              required
            />
          </div>

          {mode !== "suggest" && (
            <div className="space-y-1.5">
              <Label htmlFor="item-details">Size, colour or variant</Label>
              <Input
                id="item-details"
                ref={detailsRef}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                maxLength={100}
                placeholder="e.g. Size M, black"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="item-price">Price</Label>
            <div className="flex">
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                aria-label="Currency"
                className="h-9 rounded-l-md rounded-r-none border border-r-0 border-input bg-muted px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 shrink-0"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <Input
                id="item-price"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                inputMode="decimal"
                className="rounded-l-none"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="item-desc">Description</Label>
              <span className={`text-xs ${description.length >= 500 ? "text-destructive" : "text-muted-foreground"}`}>
                {description.length}/500
              </span>
            </div>
            <Textarea
              id="item-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Photo</Label>
            {imageUrl ? (
              <div className="relative w-full aspect-video rounded-md overflow-hidden border bg-muted">
                <img
                  src={imageUrl}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={() => setImageUrl("")}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="absolute top-2 right-2 h-7 w-7 sm:h-7 sm:w-7"
                  onClick={() => setImageUrl("")}
                >
                  <X size={14} />
                  <span className="sr-only">Remove photo</span>
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center justify-center w-full h-24 rounded-md border-2 border-dashed border-input text-muted-foreground hover:border-ring hover:text-foreground transition-colors disabled:opacity-50"
              >
                {uploading ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <span className="flex flex-col items-center gap-1 text-sm">
                    <ImagePlus size={20} />
                    Upload photo
                  </span>
                )}
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {mode === "suggest" && (
            <div className="space-y-1.5">
              <Label htmlFor="item-note">Note to {recipientName ?? "them"} (optional)</Label>
              <Textarea
                id="item-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={300}
                rows={2}
                placeholder="Thought you'd like this"
              />
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || fetching || uploading}>
              {loading && <Loader2 className="animate-spin" />}
              {saveLabels[mode]}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
