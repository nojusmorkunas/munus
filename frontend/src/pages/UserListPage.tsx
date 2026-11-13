import { useCallback, useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { api, type User, type ItemInput, type ItemView } from "@/lib/api"
import { daysUntilBirthday, turningAge, formatBirthday, formatPrice } from "@/lib/utils"
import { useSettings } from "@/contexts/SettingsContext"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import ItemDetailDialog from "@/components/ItemDetailDialog"
import ItemFormDialog from "@/components/ItemFormDialog"
import UserAvatar from "@/components/UserAvatar"
import AvailabilityNotice from "@/components/AvailabilityNotice"
import ItemThumb from "@/components/ItemThumb"
import { useToast } from "@/components/Toaster"
import { HintIcon } from "@/components/HintIcon"
import { ExternalLink, Gift, ShoppingBag, Check, Lightbulb, X } from "lucide-react"

// Claim and Bought it share one width so the buttons line up down the list.
const ROW_ACTION = "w-[6.5rem] gap-1.5"

// Things you can still give come first, then your own claims, then the rest.
function viewerRank(item: ItemView) {
  if (item.isReceived) return 3
  if (item.claimed && !item.claimedByMe) return 2
  if (item.claimedByMe) return 1
  return 0
}

function sortForViewer(items: ItemView[]) {
  // Array.prototype.sort is stable, so the owner's order is kept within each group.
  return [...items].sort((a, b) => viewerRank(a) - viewerRank(b))
}

export default function UserListPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const { currency, locale } = useSettings()
  const [targetUser, setTargetUser] = useState<User | null>(null)
  const [items, setItems] = useState<ItemView[]>([])
  const [suggestions, setSuggestions] = useState<ItemView[]>([])
  const [loading, setLoading] = useState(true)
  const [detailId, setDetailId] = useState<number | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [flashId, setFlashId] = useState<{ id: number; type: "claim" | "unclaim" } | null>(null)

  const userId = parseInt(id ?? "0", 10)

  const load = useCallback(async () => {
    const [user, all] = await Promise.all([api.users.get(userId), api.items.forUser(userId)])
    setTargetUser(user)
    return all
  }, [userId])

  useEffect(() => {
    if (!userId) return
    load()
      .then((all) => {
        // Sorted once on load so rows don't jump around while you claim things.
        setItems(sortForViewer(all.filter((i) => !i.isPending)))
        setSuggestions(all.filter((i) => i.isPending))
      })
      .catch(() => navigate("/browse"))
      .finally(() => setLoading(false))
  }, [userId, load, navigate])

  // Refreshes item data in place, keeping the current row order.
  async function refresh() {
    try {
      const fresh = (await load()).filter((i) => !i.isPending)
      setItems((prev) => {
        const byId = new Map(fresh.map((i) => [i.id, i]))
        const kept = prev.filter((i) => byId.has(i.id)).map((i) => byId.get(i.id)!)
        const added = fresh.filter((i) => !prev.some((p) => p.id === i.id))
        return [...kept, ...added]
      })
      return fresh
    } catch {
      // The next page load will catch up.
      return null
    }
  }

  const detailItem =
    items.find((i) => i.id === detailId) ?? suggestions.find((i) => i.id === detailId) ?? null
  const ownerName = targetUser?.displayName ?? ""

  function updateItem(id: number, patch: Partial<ItemView>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)))
  }

  function flash(id: number, type: "claim" | "unclaim") {
    setFlashId({ id, type })
    setTimeout(() => setFlashId(null), 1300)
  }

  function openDetail(item: ItemView) {
    setDetailId(item.id)
    setDetailOpen(true)
  }

  async function handleClaim(item: ItemView, { silent = false } = {}) {
    updateItem(item.id, { claimed: true, claimedByMe: true, claimNote: "" })
    flash(item.id, "claim")
    try {
      await api.items.claim(item.id)
      if (!silent) {
        toast({
          message: `You're getting “${item.name}”`,
          action: { label: "Undo", onClick: () => handleUnclaim({ ...item, claimed: true, claimedByMe: true }, { silent: true }) },
        })
      }
      return true
    } catch (e) {
      if ((e as { status?: number }).status === 409) {
        updateItem(item.id, { claimed: true, claimedByMe: false })
        const now = (await refresh())?.find((i) => i.id === item.id)
        toast({
          variant: "error",
          message: now?.claimedByMe
            ? "You already claimed this, maybe in another tab."
            : `${now?.claimedByName || "Someone else"} already claimed this.`,
        })
      } else {
        updateItem(item.id, { claimed: false, claimedByMe: false })
        toast({ variant: "error", message: "Couldn't claim that. Try again." })
      }
      return false
    }
  }

  async function handleUnclaim(item: ItemView, { silent = false } = {}) {
    const { claimNote, isPurchased } = item
    updateItem(item.id, { claimed: false, claimedByMe: false, isPurchased: false, claimNote: "" })
    flash(item.id, "unclaim")
    try {
      await api.items.unclaim(item.id)
    } catch {
      updateItem(item.id, { claimed: true, claimedByMe: true, isPurchased, claimNote })
      toast({ variant: "error", message: "Couldn't unclaim that. Try again." })
      return
    }
    if (silent) return
    toast({
      message: `Unclaimed “${item.name}”`,
      action: {
        label: "Undo",
        onClick: async () => {
          // Unclaiming clears the note and bought flag on the server, so put them back too.
          if (!(await handleClaim(item, { silent: true }))) return
          if (isPurchased) handlePurchase(item.id, true)
          if (claimNote) handleUpdateNote(item.id, claimNote).catch(() => {})
        },
      },
    })
  }

  async function handleUpdateNote(itemId: number, note: string) {
    updateItem(itemId, { claimNote: note })
    await api.items.updateClaimNote(itemId, note)
  }

  async function handlePurchase(itemId: number, purchased: boolean) {
    updateItem(itemId, { isPurchased: purchased })
    try {
      await (purchased ? api.items.purchase(itemId) : api.items.unpurchase(itemId))
    } catch {
      updateItem(itemId, { isPurchased: !purchased })
      toast({ variant: "error", message: "Couldn't update that. Try again." })
    }
  }

  async function handleSuggest(data: ItemInput, note: string) {
    const created = await api.suggestions.create(userId, { ...data, note })
    setSuggestions((prev) => [created, ...prev])
    toast({ message: `Sent to ${ownerName}` })
  }

  function handleWithdraw(item: ItemView) {
    setDetailOpen(false)
    const index = suggestions.findIndex((i) => i.id === item.id)
    setSuggestions((prev) => prev.filter((i) => i.id !== item.id))
    const restore = () =>
      setSuggestions((prev) =>
        prev.some((i) => i.id === item.id) ? prev : [...prev.slice(0, index), item, ...prev.slice(index)]
      )
    toast({
      message: "Suggestion withdrawn",
      action: { label: "Undo", onClick: restore },
      onClose: () => {
        api.items.delete(item.id).catch(() => {
          restore()
          toast({ variant: "error", message: "Couldn't withdraw that. It may already be on their list." })
        })
      },
    })
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-3">
        <div className="h-8 w-48 rounded bg-muted animate-pulse mb-6" />
        {[1, 2, 3].map((n) => (
          <div key={n} className="h-16 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    )
  }

  if (!targetUser) return null

  const days = daysUntilBirthday(targetUser.birthday)
  const age = turningAge(targetUser.birthday)

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 animate-in fade-in duration-200">
      <div className="mb-6 flex items-center gap-3">
        <UserAvatar user={targetUser} className="w-12 h-12" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold truncate">{targetUser.displayName}'s list</h1>
          {days !== null && (
            <p className="text-muted-foreground text-sm mt-0.5">
              {days === 0
                ? `🎂 Turning ${age} today!`
                : `Turning ${age} in ${days} day${days === 1 ? "" : "s"} (${formatBirthday(targetUser.birthday)})`}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSuggestOpen(true)}
          className="shrink-0 gap-1.5"
        >
          <Lightbulb size={14} />
          <span className="sm:hidden">Suggest</span>
          <span className="hidden sm:inline">Suggest an idea</span>
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="text-center text-muted-foreground py-12 space-y-1">
          <p>No items on this list yet.</p>
          <p className="text-sm">Have an idea? Suggest it and {targetUser.displayName} can add it.</p>
        </div>
      ) : (
        <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {items.map((item) => (
            <Card key={item.id} className={`hover:shadow-md ${item.isReceived ? "opacity-60" : ""} ${flashId?.id === item.id ? (flashId.type === "claim" ? "claim-flash" : "unclaim-flash") : ""}`}>
              <CardContent className="p-3 flex items-center gap-2">
                <ItemThumb src={item.imageUrl} onClick={() => openDetail(item)} />

                <button type="button" className="flex-1 min-w-0 text-left min-h-[44px]" onClick={() => openDetail(item)}>
                  <p className="font-semibold text-sm leading-tight line-clamp-1">{item.name}</p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    {item.price && (
                      <span className="text-xs text-muted-foreground">
                        {formatPrice(item.price, locale, item.currency || currency)}
                      </span>
                    )}
                    {item.isReceived && (
                      <Badge className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                        <Check size={10} className="mr-0.5" />
                        Received
                      </Badge>
                    )}
                    <AvailabilityNotice status={item.availabilityStatus} checkedAt={item.availabilityCheckedAt} />
                    {item.claimedByMe && !item.isReceived && (
                      <Badge className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                        {item.isPurchased ? "Bought" : "Getting this"}
                      </Badge>
                    )}
                  </div>
                </button>

                {!item.isReceived && item.claimed && !item.claimedByMe ? (
                  <div className="shrink-0 text-right text-xs text-muted-foreground leading-snug">
                    <p>Claimed by</p>
                    <p className="font-medium text-foreground">{item.claimedByName || "someone"}</p>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 shrink-0">
                    {item.url && (
                      <Button variant="ghost" size="icon" asChild >
                        <a href={item.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink size={15} />
                          <span className="sr-only">Open link</span>
                        </a>
                      </Button>
                    )}
                    {!item.isReceived && !item.claimed && (
                      <Button variant="outline" size="sm" onClick={() => handleClaim(item)} className={ROW_ACTION}>
                        <Gift size={14} />
                        Claim
                      </Button>
                    )}
                    {!item.isReceived && item.claimedByMe && !item.isPurchased && (
                      <Button variant="outline" size="sm" onClick={() => handlePurchase(item.id, true)} className={ROW_ACTION}>
                        <ShoppingBag size={14} />
                        Bought it
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {suggestions.length > 0 && (
        <section className="mt-8 space-y-2">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <Lightbulb size={15} className="text-amber-500" />
            Your suggestions
            <HintIcon label="About your suggestions">
              Waiting for {targetUser.displayName} to add them. Nobody else can see these.
            </HintIcon>
          </h2>
          {suggestions.map((item) => (
            <Card key={item.id} className="border-dashed">
              <CardContent className="p-3 flex items-center gap-2">
                <ItemThumb src={item.imageUrl} onClick={() => openDetail(item)} />
                <button type="button" className="flex-1 min-w-0 text-left min-h-[44px]" onClick={() => openDetail(item)}>
                  <p className="font-semibold text-sm leading-tight line-clamp-1">{item.name}</p>
                  {item.price && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatPrice(item.price, locale, item.currency || currency)}
                    </p>
                  )}
                </button>
                <Button variant="ghost" size="icon" onClick={() => handleWithdraw(item)} className="shrink-0">
                  <X size={15} />
                  <span className="sr-only">Withdraw suggestion</span>
                </Button>
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      <ItemDetailDialog
        item={detailItem}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        mode="viewer"
        ownerName={ownerName}
        onClaim={() => { if (detailItem) return handleClaim(detailItem).then(() => {}) }}
        onUnclaim={() => detailItem && handleUnclaim(detailItem)}
        onUpdateNote={(note) => detailItem ? handleUpdateNote(detailItem.id, note) : Promise.resolve()}
        onPurchase={() => detailItem && handlePurchase(detailItem.id, true)}
        onUnpurchase={() => detailItem && handlePurchase(detailItem.id, false)}
        onWithdraw={() => detailItem && handleWithdraw(detailItem)}
      />

      <ItemFormDialog
        open={suggestOpen}
        onOpenChange={setSuggestOpen}
        mode="suggest"
        recipientName={ownerName}
        onSave={handleSuggest}
      />
    </div>
  )
}
