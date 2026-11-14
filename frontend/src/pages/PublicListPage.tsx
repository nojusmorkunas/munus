import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { api, type PublicUser, type PublicItemView } from "@/lib/api"
import { daysUntilBirthday, turningAge, formatBirthday, formatPrice } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import UserAvatar from "@/components/UserAvatar"
import AvailabilityNotice from "@/components/AvailabilityNotice"
import ItemThumb from "@/components/ItemThumb"
import { ExternalLink } from "lucide-react"


export default function PublicListPage() {
  const { token } = useParams<{ token: string }>()
  const [listUser, setListUser] = useState<PublicUser | null>(null)
  const [items, setItems] = useState<PublicItemView[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!token) return
    api.public(token)
      .then(({ user, items }) => {
        setListUser(user)
        setItems(items)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-3">
        <div className="h-8 w-48 rounded bg-muted animate-pulse mb-6" />
        {[1, 2, 3].map((n) => (
          <div key={n} className="h-16 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    )
  }

  if (notFound || !listUser) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <p className="text-xl font-semibold mb-2">List not found</p>
        <p className="text-muted-foreground">This link may be invalid or no longer active.</p>
      </div>
    )
  }

  const days = daysUntilBirthday(listUser.birthday)
  const age = turningAge(listUser.birthday)

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background sticky top-0 z-40">
        <div className="flex items-center justify-between h-14 px-4 max-w-2xl mx-auto w-full">
          <span className="font-bold text-lg tracking-tight">Munus</span>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 animate-in fade-in duration-200">
        <div className="mb-6 flex items-center gap-3">
          <UserAvatar user={listUser} className="w-12 h-12" />
          <div className="min-w-0">
            <h1 className="text-2xl font-bold truncate">{listUser.displayName}'s gift list</h1>
            {days !== null && (
              <p className="text-muted-foreground text-sm mt-0.5">
                {days === 0
                  ? `🎂 Turning ${age} today!`
                  : `Turning ${age} in ${days} day${days === 1 ? "" : "s"} (${formatBirthday(listUser.birthday)})`}
              </p>
            )}
          </div>
        </div>

        {items.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">No items on this list yet.</p>
        ) : (
          <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {items.map((item) => (
              <Card key={item.id} className="transition-shadow hover:shadow-md">
                <CardContent className="p-3 flex items-start gap-2 sm:items-center">
                  <ItemThumb src={item.imageUrl} />

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm leading-tight line-clamp-1">{item.name}</p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      {item.price && (
                        <Badge variant="secondary" className="text-xs">
                          {formatPrice(item.price, navigator.language, item.currency || "EUR")}
                        </Badge>
                      )}
                      {item.claimed && (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          Already claimed
                        </Badge>
                      )}
                      <AvailabilityNotice status={item.availabilityStatus} checkedAt={item.availabilityCheckedAt} />
                    </div>
                    {/* Share-link viewers can't open an item, so its size or colour shows here, above the description. */}
                    {item.details && (
                      <p className="text-xs font-medium mt-1 line-clamp-1">{item.details}</p>
                    )}
                    {item.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.description}</p>
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
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
