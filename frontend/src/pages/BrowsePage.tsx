import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { api, type User, type ItemView } from "@/lib/api"
import { useAuth } from "@/App"
import { daysUntilBirthday, formatBirthday } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import UserAvatar from "@/components/UserAvatar"
import { ChevronRight } from "lucide-react"
import { HintIcon } from "@/components/HintIcon"

interface Entry {
  user: User
  items: ItemView[]
  days: number | null
}

// Birthdays this close get highlighted so they stand out when scanning.
const SOON_DAYS = 30

// Whoever's birthday is next comes first. People without a birthday go last,
// alphabetically.
function byNextBirthday(a: Entry, b: Entry) {
  if (a.days !== null && b.days !== null && a.days !== b.days) return a.days - b.days
  if (a.days === null && b.days !== null) return 1
  if (a.days !== null && b.days === null) return -1
  return a.user.displayName.localeCompare(b.user.displayName)
}

// Fixed width, and always rendered (empty without a birthday), so the countdown
// and the text next to it line up in every row.
function Countdown({ days, birthday }: { days: number | null; birthday: string }) {
  if (days === null) return <div className="w-12 shrink-0" aria-hidden />
  const soon = days <= SOON_DAYS
  const label = days === 0 ? "Birthday today" : `Birthday in ${days} day${days === 1 ? "" : "s"}, ${formatBirthday(birthday)}`
  return (
    <div
      className={`w-12 shrink-0 flex flex-col items-center leading-none ${soon ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`}
      aria-label={label}
      title={label}
    >
      <span className={`h-6 flex items-center text-xl tabular-nums ${days === 0 ? "" : "font-semibold"} ${soon ? "" : "text-foreground/70"}`}>
        {days === 0 ? <span aria-hidden>🎂</span> : days}
      </span>
      <span className="text-[11px] mt-0.5">{days === 0 ? "today" : days === 1 ? "day" : "days"}</span>
    </div>
  )
}

function PersonRow({ entry }: { entry: Entry }) {
  const { user: u, items, days } = entry
  const total = items.length
  const open = items.filter((i) => !i.claimed && !i.isReceived).length
  const mine = items.filter((i) => i.claimedByMe && !i.isReceived).length

  // "up for grabs" rather than "left to claim", which read like a to-do. Not
  // "available" either: that word already means in stock (see AvailabilityNotice).
  const status = total === 0 ? "No items yet" : open === 0 ? "All claimed" : `${open} up for grabs`

  return (
    // The link covers the whole card (absolute inset-0) instead of wrapping it,
    // so the gift hint can sit on top as its own button and cmd-click still
    // opens the list in a new tab.
    <Card className="relative h-full min-h-[70px] flex items-center gap-3 p-3 pr-2 transition-shadow hover:shadow-md focus-within:ring-2 focus-within:ring-ring">
      <Link
        to={`/users/${u.id}`}
        aria-label={`${u.displayName}'s list`}
        className="absolute inset-0 rounded-xl outline-none"
      />
      <UserAvatar user={u} className="w-11 h-11 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className="font-semibold leading-tight truncate">{u.displayName}</p>
          {mine > 0 && (
            <HintIcon icon="gift" label={`You're getting ${mine}`} className="relative z-10">
              You're getting {mine} {mine === 1 ? "gift" : "gifts"} from {u.displayName}'s list.
            </HintIcon>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1 truncate">{status}</p>
      </div>
      <Countdown days={days} birthday={u.birthday} />
      <ChevronRight size={18} className="text-muted-foreground/60 shrink-0" aria-hidden />
    </Card>
  )
}

export default function BrowsePage() {
  const { user } = useAuth()
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.users.list().then(async (all) => {
      const others = all.filter((u) => u.id !== user.id)
      const results = await Promise.all(
        others.map((u) =>
          api.items
            .forUser(u.id)
            // Your own pending suggestions come back too, but they are not on the list yet.
            .then((items) => items.filter((i) => !i.isPending))
            .catch(() => [] as ItemView[])
            .then((items) => ({ user: u, items, days: daysUntilBirthday(u.birthday) }))
        )
      )
      setEntries(results.sort(byNextBirthday))
    }).finally(() => setLoading(false))
  }, [user.id])

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 animate-in fade-in duration-200">
      <h1 className="text-2xl font-bold mb-4">Browse</h1>
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-[70px] rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">No other people here yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {entries.map((entry) => (
            <PersonRow key={entry.user.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  )
}
