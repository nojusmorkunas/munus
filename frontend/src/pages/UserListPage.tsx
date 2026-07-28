import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { api, type User, type ItemView } from "@/lib/api"
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
import ItemDetailDialog from "@/components/ItemDetailDialog"
import UserAvatar from "@/components/UserAvatar"
import AvailabilityNotice from "@/components/AvailabilityNotice"
import { ExternalLink, Gift, Undo2, ShoppingBag, PackageCheck, Check } from "lucide-react"


export default function UserListPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currency, locale } = useSettings()
  const [targetUser, setTargetUser] = useState<User | null>(null)
  const [items, setItems] = useState<ItemView[]>([])
  const [loading, setLoading] = useState(true)
  const [detailItem, setDetailItem] = useState<ItemView | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [flashId, setFlashId] = useState<{ id: number; type: "claim" | "unclaim" } | null>(null)

  const userId = parseInt(id ?? "0", 10)

  useEffect(() => {
    if (!userId) return
    Promise.all([api.users.get(userId), api.items.forUser(userId)])
      .then(([user, items]) => {
        setTargetUser(user)
        setItems(items)
      })
      .catch(() => navigate("/browse"))
      .finally(() => setLoading(false))
  }, [userId, navigate])

  function openDetail(item: ItemView) {
    setDetailItem(item)
    setDetailOpen(true)
  }

  function updateItem(id: number, patch: Partial<ItemView>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)))
    setDetailItem((prev) => (prev?.id === id ? { ...prev, ...patch } : prev))
  }

  async function handleClaim(itemId: number) {
    updateItem(itemId, { claimed: true, claimedByMe: true, claimNote: "" })
    api.items.claim(itemId)
    setFlashId({ id: itemId, type: "claim" })
    setTimeout(() => setFlashId(null), 1300)
  }

  async function handleUpdateNote(itemId: number, note: string) {
    updateItem(itemId, { claimNote: note })
    await api.items.updateClaimNote(itemId, note)
  }

  async function handleUnclaim(itemId: number) {
    updateItem(itemId, { claimed: false, claimedByMe: false, isPurchased: false, claimNote: "" })
    api.items.unclaim(itemId)
    setFlashId({ id: itemId, type: "unclaim" })
    setTimeout(() => setFlashId(null), 1300)
  }

  async function handlePurchase(itemId: number) {
    updateItem(itemId, { isPurchased: true })
    api.items.purchase(itemId)
  }

  async function handleUnpurchase(itemId: number) {
    updateItem(itemId, { isPurchased: false })
    api.items.unpurchase(itemId)
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
        <div className="min-w-0">
          <h1 className="text-2xl font-bold truncate">{targetUser.displayName}'s list</h1>
          {days !== null && (
            <p className="text-muted-foreground text-sm mt-0.5">
              {days === 0
                ? `🎂 Turning ${age} today!`
                : `Turning ${age} in ${days} day${days === 1 ? "" : "s"} (${formatBirthday(targetUser.birthday)})`}
            </p>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">No items on this list yet.</p>
      ) : (
        <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {items.map((item) => (
            <Card key={item.id} className={`hover:shadow-md ${item.isReceived ? "opacity-60" : ""} ${flashId?.id === item.id ? (flashId.type === "claim" ? "claim-flash" : "unclaim-flash") : ""}`}>
              <CardContent className="p-3 flex items-center gap-2">
                {item.imageUrl && (
                  <img
                    src={item.imageUrl}
                    alt=""
                    className="w-12 h-12 rounded-md object-cover shrink-0 bg-muted cursor-pointer"
                    onClick={() => openDetail(item)}
                    onError={(e) => (e.currentTarget.style.display = "none")}
                  />
                )}

                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openDetail(item)}>
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
{item.claimedByMe && (
                      <Badge className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                        {item.isPurchased ? "Bought" : "Getting this"}
                      </Badge>
                    )}
                  </div>
                </div>

                {!item.isReceived && item.claimed && !item.claimedByMe ? (
                  <div className="shrink-0 text-right text-xs text-muted-foreground leading-snug">
                    <p>Claimed by</p>
                    <p className="font-medium text-foreground">{item.claimedByName || "someone"}</p>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 shrink-0">
                    {item.url && (
                      <Button variant="ghost" size="icon" asChild className="h-9 w-9">
                        <a href={item.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink size={15} />
                          <span className="sr-only">Open link</span>
                        </a>
                      </Button>
                    )}
                    {!item.isReceived && !item.claimed && (
                      <Button variant="outline" size="sm" onClick={() => openDetail(item)} className="h-9 gap-1.5 text-xs">
                        <Gift size={14} />
                        Claim
                      </Button>
                    )}
                    {!item.isReceived && item.claimedByMe && (
                      <>
                        {!item.isPurchased ? (
                          <Button variant="ghost" size="icon" onClick={() => handlePurchase(item.id)} className="h-9 w-9" title="Mark as bought">
                            <ShoppingBag size={14} />
                          </Button>
                        ) : (
                          <Button variant="ghost" size="icon" onClick={() => handleUnpurchase(item.id)} className="h-9 w-9" title="Unmark bought">
                            <PackageCheck size={14} />
                          </Button>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9">
                              <Undo2 size={14} />
                              <span className="sr-only">Unclaim</span>
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Unclaim "{item.name}"?</AlertDialogTitle>
                              <AlertDialogDescription>Your claim and note will be removed.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleUnclaim(item.id)}>Unclaim</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ItemDetailDialog
        item={detailItem}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        mode="viewer"
        onClaim={() => detailItem && handleClaim(detailItem.id)}
        onUnclaim={() => detailItem && handleUnclaim(detailItem.id)}
        onUpdateNote={(note) => detailItem ? handleUpdateNote(detailItem.id, note) : Promise.resolve()}
        onPurchase={() => detailItem && handlePurchase(detailItem.id)}
        onUnpurchase={() => detailItem && handleUnpurchase(detailItem.id)}
      />

    </div>
  )
}
