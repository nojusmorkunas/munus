import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { api, type ItemInput, type ItemView } from "@/lib/api"
import { useAuth, useSetSuggestionCount } from "@/App"
import { daysUntilBirthday, turningAge, formatBirthday, formatPrice } from "@/lib/utils"
import { useSettings } from "@/contexts/SettingsContext"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
import ItemFormDialog, { type ItemFormMode } from "@/components/ItemFormDialog"
import ItemDetailDialog from "@/components/ItemDetailDialog"
import AvailabilityNotice from "@/components/AvailabilityNotice"
import ItemThumb from "@/components/ItemThumb"
import { useToast } from "@/components/Toaster"
import { HintIcon, SuggestionHint } from "@/components/HintIcon"
import SuggestionNote from "@/components/SuggestionNote"
import {
  ExternalLink,
  Plus,
  Trash2,
  GripVertical,
  ArchiveRestore,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Lightbulb,
} from "lucide-react"

// Lets a non-button element open on Enter or Space, ignoring keys pressed on
// buttons inside it (like a hint icon).
function openOnKey(open: () => void) {
  return (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget) return
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      open()
    }
  }
}

// Android share sheets often put the link inside the shared text.
function firstUrl(text: string | null) {
  return text?.match(/https?:\/\/\S+/)?.[0] ?? ""
}

function SortableItemCard({ item, onOpen }: { item: ItemView; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  })
  const { currency, locale } = useSettings()

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? "opacity-50 z-50 relative" : ""}
    >
      <Card className="transition-shadow hover:shadow-md">
        <CardContent className="p-3 flex items-center gap-2">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab text-muted-foreground hover:text-foreground shrink-0 p-1 touch-none min-h-[44px] min-w-[28px] flex items-center justify-center"
          >
            <GripVertical size={16} />
            <span className="sr-only">Drag to reorder</span>
          </button>

          <ItemThumb src={item.imageUrl} onClick={onOpen} />

          <div
            role="button"
            tabIndex={0}
            className="flex-1 min-w-0 min-h-[44px] flex flex-col justify-center cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
            onClick={onOpen}
            onKeyDown={openOnKey(onOpen)}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <p className="font-semibold text-sm leading-tight truncate">{item.name}</p>
              {item.suggestedByName && (
                <SuggestionHint name={item.suggestedByName} note={item.suggestionNote} />
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {item.price && (
                <span className="text-xs text-muted-foreground">
                  {formatPrice(item.price, locale, item.currency || currency)}
                </span>
              )}
              {item.isReceived && (
                <Badge className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                  Received
                </Badge>
              )}
              <AvailabilityNotice status={item.availabilityStatus} checkedAt={item.availabilityCheckedAt} />
            </div>
          </div>

          {item.url && (
            <Button variant="ghost" size="icon" asChild className="shrink-0">
              <a href={item.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={15} />
                <span className="sr-only">Open link</span>
              </a>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function SuggestionCard({
  item,
  onAccept,
  onDismiss,
}: {
  item: ItemView
  onAccept: () => void
  onDismiss: () => void
}) {
  const { currency, locale } = useSettings()
  return (
    <Card className="border-amber-200 bg-amber-50/60 dark:border-amber-900/60 dark:bg-amber-950/20">
      <CardContent className="p-3 space-y-3">
        <div className="flex items-center gap-2">
          <ItemThumb src={item.imageUrl} />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm leading-tight truncate">{item.name}</p>
            {item.price && (
              <p className="text-xs text-muted-foreground mt-1">
                {formatPrice(item.price, locale, item.currency || currency)}
              </p>
            )}
          </div>
          {item.url && (
            <Button variant="ghost" size="icon" asChild className="shrink-0">
              <a href={item.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={15} />
                <span className="sr-only">Open link</span>
              </a>
            </Button>
          )}
        </div>
        <SuggestionNote name={item.suggestedByName} note={item.suggestionNote} />
        <div className="flex gap-2">
          <Button size="sm" onClick={onAccept} className="flex-1 sm:flex-none">
            <Plus size={15} />
            Add to my list
          </Button>
          <Button size="sm" variant="ghost" onClick={onDismiss} className="flex-1 sm:flex-none">
            No thanks
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default function MyListPage() {
  const { user } = useAuth()
  const setSuggestionCount = useSetSuggestionCount()
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const [items, setItems] = useState<ItemView[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<ItemFormMode>("add")
  const [editing, setEditing] = useState<ItemView | undefined>()
  const [sharedUrl, setSharedUrl] = useState("")
  const [detailId, setDetailId] = useState<number | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [copied, setCopied] = useState(false)

  const days = daysUntilBirthday(user.birthday)
  const age = turningAge(user.birthday)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  useEffect(() => {
    api.items.mine().then(setItems).finally(() => setLoading(false))
  }, [])

  // Links shared to the installed app arrive as /my-list?url=... (see share_target
  // in the web manifest). Open the add form with that link and clear the query.
  useEffect(() => {
    const shared = firstUrl(searchParams.get("url")) || firstUrl(searchParams.get("text"))
    if (!shared) return
    setSharedUrl(shared)
    setEditing(undefined)
    setFormMode("add")
    setFormOpen(true)
    setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams])

  const suggestions = items.filter((i) => i.isPending)
  const activeItems = items.filter((i) => !i.isPending && !i.isArchived)
  const archivedItems = items.filter((i) => !i.isPending && i.isArchived)
  const detailItem = items.find((i) => i.id === detailId) ?? null

  useEffect(() => {
    if (!loading) setSuggestionCount(suggestions.length)
  }, [loading, suggestions.length, setSuggestionCount])

  function patch(id: number, changes: Partial<ItemView>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...changes } : i)))
  }

  function failed(message: string) {
    toast({ variant: "error", message })
  }

  function openAdd() {
    setEditing(undefined)
    setSharedUrl("")
    setFormMode("add")
    setFormOpen(true)
  }

  function openEdit(item: ItemView) {
    setDetailOpen(false)
    setEditing(item)
    setFormMode("edit")
    setFormOpen(true)
  }

  function openAccept(item: ItemView) {
    setEditing(item)
    setFormMode("accept")
    setFormOpen(true)
  }

  function openDetail(item: ItemView) {
    setDetailId(item.id)
    setDetailOpen(true)
  }

  async function handleSave(data: ItemInput) {
    if (formMode === "accept" && editing) {
      const accepted = await api.items.accept(editing.id, data)
      // Accepted suggestions go to the top of the list, like new items.
      setItems((prev) => [accepted, ...prev.filter((i) => i.id !== accepted.id)])
      toast({ message: `Added “${accepted.name}” to your list` })
    } else if (formMode === "edit" && editing) {
      const updated = await api.items.update(editing.id, data)
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
    } else {
      const created = await api.items.create(data)
      setItems((prev) => [created, ...prev])
    }
  }

  function removeLocally(item: ItemView) {
    const index = items.findIndex((i) => i.id === item.id)
    setItems((prev) => prev.filter((i) => i.id !== item.id))
    // Puts the item back where it was if the server says no.
    return () =>
      setItems((prev) =>
        prev.some((i) => i.id === item.id) ? prev : [...prev.slice(0, index), item, ...prev.slice(index)]
      )
  }

  async function handleDelete(item: ItemView) {
    setDetailOpen(false)
    const restore = removeLocally(item)
    try {
      await api.items.delete(item.id)
    } catch {
      restore()
      failed("Couldn't delete that. Try again.")
    }
  }

  function handleDismiss(item: ItemView) {
    // The delete waits until the Undo window closes, so Undo needs no server call.
    const restore = removeLocally(item)
    toast({
      message: "Suggestion dismissed",
      action: { label: "Undo", onClick: restore },
      onClose: () => {
        api.items.delete(item.id).catch(() => {
          restore()
          failed("Couldn't dismiss that suggestion. Try again.")
        })
      },
    })
  }

  async function handleArchive(item: ItemView, archived: boolean) {
    patch(item.id, { isArchived: archived })
    if (archived) setDetailOpen(false)
    try {
      await (archived ? api.items.archive(item.id) : api.items.unarchive(item.id))
      if (archived) {
        toast({
          message: `Archived “${item.name}”`,
          action: { label: "Undo", onClick: () => handleArchive(item, false) },
        })
      }
    } catch {
      patch(item.id, { isArchived: !archived })
      failed(archived ? "Couldn't archive that. Try again." : "Couldn't restore that. Try again.")
    }
  }

  async function handleReceived(item: ItemView, received: boolean) {
    patch(item.id, { isReceived: received })
    try {
      await (received ? api.items.received(item.id) : api.items.unreceived(item.id))
    } catch {
      patch(item.id, { isReceived: !received })
      failed("Couldn't update that. Try again.")
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const previous = items
    const oldIdx = activeItems.findIndex((i) => i.id === active.id)
    const newIdx = activeItems.findIndex((i) => i.id === over.id)
    const reordered = arrayMove(activeItems, oldIdx, newIdx)
    setItems([...suggestions, ...reordered, ...archivedItems])
    try {
      await api.items.reorder(reordered.map((i) => i.id))
    } catch {
      setItems(previous)
      failed("Couldn't save the new order. Try again.")
    }
  }

  async function copyLink() {
    const url = `${window.location.origin}/share/${user.publicToken}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 animate-in fade-in duration-200">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold truncate">{user.displayName}</h1>
          {days !== null && (
            <p className="text-muted-foreground text-sm mt-0.5">
              {days === 0
                ? `🎂 Turning ${age} today!`
                : `Turning ${age} in ${days} day${days === 1 ? "" : "s"} (${formatBirthday(user.birthday)})`}
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={copyLink} className="shrink-0 relative overflow-hidden">
          <span className={`flex items-center gap-1.5 transition-all duration-200 ${copied ? "opacity-0 -translate-y-2" : "opacity-100 translate-y-0"}`}>
            <Copy size={14} />
            Share list
          </span>
          <span className={`absolute inset-0 flex items-center justify-center gap-1.5 transition-all duration-200 ${copied ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}>
            <Check size={14} className="text-green-600" />
            Copied!
          </span>
        </Button>
      </div>

      {suggestions.length > 0 && (
        <section className="mb-5 space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <Lightbulb size={15} className="text-amber-500" />
            Suggested for you ({suggestions.length})
            <HintIcon label="About suggestions">
              Nobody else sees these until you add them to your list.
            </HintIcon>
          </h2>
          {suggestions.map((item) => (
            <SuggestionCard
              key={item.id}
              item={item}
              onAccept={() => openAccept(item)}
              onDismiss={() => handleDismiss(item)}
            />
          ))}
        </section>
      )}

      <Button onClick={openAdd} className="w-full mb-5">
        <Plus size={18} />
        Add item
      </Button>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-16 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : activeItems.length === 0 && archivedItems.length === 0 ? (
        <div className="text-center text-muted-foreground py-12 space-y-1">
          <p className="font-medium text-foreground">Your list is empty</p>
          <p className="text-sm">Paste a product link into Add item and the name, price and photo fill in for you.</p>
        </div>
      ) : (
        <>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={activeItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                {activeItems.map((item) => (
                  <SortableItemCard key={item.id} item={item} onOpen={() => openDetail(item)} />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {archivedItems.length > 0 && (
            <div className="mt-6">
              <button
                onClick={() => setShowArchived((v) => !v)}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2 min-h-[36px]"
              >
                {showArchived ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                Archived ({archivedItems.length})
              </button>
              {showArchived && (
                <div className="space-y-2">
                  {archivedItems.map((item) => (
                    <Card key={item.id} className="opacity-60">
                      <CardContent className="p-3 flex items-center gap-2">
                        <ItemThumb src={item.imageUrl} className="w-10 h-10" />
                        <p className="flex-1 text-sm font-medium line-clamp-1 min-w-0">{item.name}</p>
                        <Button variant="ghost" size="icon" onClick={() => handleArchive(item, false)} className="shrink-0">
                          <ArchiveRestore size={15} />
                          <span className="sr-only">Unarchive</span>
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="shrink-0 text-destructive hover:text-destructive">
                              <Trash2 size={15} />
                              <span className="sr-only">Delete</span>
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete item?</AlertDialogTitle>
                              <AlertDialogDescription>"{item.name}" will be permanently removed.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(item)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      <ItemFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        initial={editing}
        initialUrl={formMode === "add" ? sharedUrl : undefined}
        onSave={handleSave}
      />

      <ItemDetailDialog
        item={detailItem}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        mode="owner"
        onEdit={() => detailItem && openEdit(detailItem)}
        onDelete={() => detailItem && handleDelete(detailItem)}
        onReceived={() => detailItem && handleReceived(detailItem, true)}
        onUnreceived={() => detailItem && handleReceived(detailItem, false)}
        onArchive={() => detailItem && handleArchive(detailItem, true)}
        onUnarchive={() => detailItem && handleArchive(detailItem, false)}
      />
    </div>
  )
}
