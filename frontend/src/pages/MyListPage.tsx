import { useEffect, useState } from "react"
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
import { api, type ItemView } from "@/lib/api"
import { useAuth } from "@/App"
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
import ItemFormDialog from "@/components/ItemFormDialog"
import ItemDetailDialog from "@/components/ItemDetailDialog"
import {
  ExternalLink,
  Pencil,
  Plus,
  Trash2,
  GripVertical,
  Archive,
  ArchiveRestore,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
} from "lucide-react"


function SortableItemCard({
  item,
  onEdit,
  onDelete,
  onArchive,
  onOpen,
}: {
  item: ItemView
  onEdit: () => void
  onDelete: () => void
  onArchive: () => void
  onOpen: () => void
}) {
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
            tabIndex={-1}
          >
            <GripVertical size={16} />
          </button>

          {item.imageUrl && (
            <img
              src={item.imageUrl}
              alt=""
              className="w-12 h-12 rounded-md object-cover shrink-0 bg-muted cursor-pointer"
              onClick={onOpen}
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          )}

          <div className="flex-1 min-w-0 cursor-pointer" onClick={onOpen}>
            <p className="font-semibold text-sm leading-tight line-clamp-1">{item.name}</p>
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
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {item.url && (
              <Button variant="ghost" size="icon" asChild className="h-9 w-9">
                <a href={item.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={15} />
                  <span className="sr-only">Open link</span>
                </a>
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onEdit} className="h-9 w-9">
              <Pencil size={15} />
              <span className="sr-only">Edit</span>
            </Button>
            <Button variant="ghost" size="icon" onClick={onArchive} className="h-9 w-9 text-muted-foreground hover:text-foreground">
              <Archive size={15} />
              <span className="sr-only">Archive</span>
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:text-destructive">
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
                  <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function MyListPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<ItemView[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ItemView | undefined>()
  const [detailItem, setDetailItem] = useState<ItemView | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [copied, setCopied] = useState(false)

  const days = daysUntilBirthday(user.birthday)
  const age = turningAge(user.birthday)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  useEffect(() => {
    api.items.mine().then(setItems).finally(() => setLoading(false))
  }, [])

  const activeItems = items.filter((i) => !i.isArchived)
  const archivedItems = items.filter((i) => i.isArchived)

  function openAdd() {
    setEditing(undefined)
    setDialogOpen(true)
  }

  function openEdit(item: ItemView) {
    setEditing(item)
    setDialogOpen(true)
  }

  function openDetail(item: ItemView) {
    setDetailItem(item)
    setDetailOpen(true)
  }

  async function handleSave(data: Parameters<typeof api.items.create>[0]) {
    if (editing) {
      const updated = await api.items.update(editing.id, data)
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
    } else {
      const created = await api.items.create(data)
      setItems((prev) => [created, ...prev])
    }
  }

  async function handleDelete(id: number) {
    setItems((prev) => prev.filter((i) => i.id !== id))
    api.items.delete(id)
  }

  async function handleArchive(id: number) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, isArchived: true } : i)))
    if (detailItem?.id === id) setDetailItem((prev) => prev ? { ...prev, isArchived: true } : null)
    api.items.archive(id)
  }

  async function handleUnarchive(id: number) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, isArchived: false } : i)))
    if (detailItem?.id === id) setDetailItem((prev) => prev ? { ...prev, isArchived: false } : null)
    api.items.unarchive(id)
  }

  async function handleReceived(id: number) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, isReceived: true } : i)))
    if (detailItem?.id === id) setDetailItem((prev) => prev ? { ...prev, isReceived: true } : null)
    api.items.received(id)
  }

  async function handleUnreceived(id: number) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, isReceived: false } : i)))
    if (detailItem?.id === id) setDetailItem((prev) => prev ? { ...prev, isReceived: false } : null)
    api.items.unreceived(id)
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = activeItems.findIndex((i) => i.id === active.id)
    const newIdx = activeItems.findIndex((i) => i.id === over.id)
    const reordered = arrayMove(activeItems, oldIdx, newIdx)
    setItems([...reordered, ...archivedItems])
    try {
      await api.items.reorder(reordered.map((i) => i.id))
    } catch {
      // optimistic; ignore failure
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
        <Button variant="outline" size="sm" onClick={copyLink} className="shrink-0 relative overflow-hidden min-h-[44px] sm:min-h-[36px]">
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

      <Button onClick={openAdd} className="w-full mb-5 min-h-[44px]">
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
        <p className="text-center text-muted-foreground py-12">No items yet. Add something you want!</p>
      ) : (
        <>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={activeItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                {activeItems.map((item) => (
                  <SortableItemCard
                    key={item.id}
                    item={item}
                    onEdit={() => openEdit(item)}
                    onDelete={() => handleDelete(item.id)}
                    onArchive={() => handleArchive(item.id)}
                    onOpen={() => openDetail(item)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {archivedItems.length > 0 && (
            <div className="mt-6">
              <button
                onClick={() => setShowArchived((v) => !v)}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
              >
                {showArchived ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                Archived ({archivedItems.length})
              </button>
              {showArchived && (
                <div className="space-y-2">
                  {archivedItems.map((item) => (
                    <Card key={item.id} className="opacity-60">
                      <CardContent className="p-3 flex items-center gap-2">
                        {item.imageUrl && (
                          <img
                            src={item.imageUrl}
                            alt=""
                            className="w-10 h-10 rounded-md object-cover shrink-0 bg-muted"
                            onError={(e) => (e.currentTarget.style.display = "none")}
                          />
                        )}
                        <p className="flex-1 text-sm font-medium line-clamp-1 min-w-0">{item.name}</p>
                        <Button variant="ghost" size="icon" onClick={() => handleUnarchive(item.id)} className="h-9 w-9 shrink-0">
                          <ArchiveRestore size={15} />
                          <span className="sr-only">Unarchive</span>
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-destructive hover:text-destructive">
                              <Trash2 size={15} />
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
                                onClick={() => handleDelete(item.id)}
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
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        onSave={handleSave}
      />

      <ItemDetailDialog
        item={detailItem}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        mode="owner"
        onReceived={() => detailItem && handleReceived(detailItem.id)}
        onUnreceived={() => detailItem && handleUnreceived(detailItem.id)}
        onArchive={() => { detailItem && handleArchive(detailItem.id); setDetailOpen(false) }}
        onUnarchive={() => detailItem && handleUnarchive(detailItem.id)}
      />
    </div>
  )
}
