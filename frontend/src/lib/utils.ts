import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Currencies offered in the item form and the admin defaults.
export const CURRENCIES = [
  "EUR", "USD", "GBP", "PLN", "SEK", "NOK", "DKK",
  "CHF", "JPY", "CAD", "AUD", "HUF", "CZK", "RON",
]

export function formatPrice(price: string, locale: string, currency: string): string {
  if (!price) return ""
  const num = parseFloat(price.replace(",", "."))
  if (!isNaN(num)) {
    try {
      return new Intl.NumberFormat(locale || navigator.language || "en-GB", {
        style: "currency",
        currency: currency || "EUR",
      }).format(num)
    } catch {
      return price
    }
  }
  return price
}

// Birthdays are stored as "YYYY-MM-DD". Parsing them by hand keeps them on the
// right calendar day: new Date("YYYY-MM-DD") is UTC midnight, which is the day
// before in timezones west of UTC.
function parseBirthday(birthday: string) {
  const [y, m, d] = birthday.split("-").map(Number)
  if (!y || !m || !d) return null
  return { year: y, month: m - 1, day: d }
}

function startOfToday() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

// The next time the birthday comes round, counting today as "0 days away".
function nextBirthday(birthday: string) {
  const b = parseBirthday(birthday)
  if (!b) return null
  const today = startOfToday()
  let next = new Date(today.getFullYear(), b.month, b.day)
  if (next < today) next = new Date(today.getFullYear() + 1, b.month, b.day)
  return { date: next, birthYear: b.year, today }
}

export function daysUntilBirthday(birthday: string): number | null {
  if (!birthday) return null
  const next = nextBirthday(birthday)
  if (!next) return null
  // Round rather than ceil so a daylight-saving hour doesn't add a day.
  return Math.round((next.date.getTime() - next.today.getTime()) / 86400000)
}

export function formatBirthday(birthday: string): string {
  if (!birthday) return ""
  const b = parseBirthday(birthday)
  if (!b) return ""
  return new Date(2000, b.month, b.day).toLocaleDateString("en-GB", { day: "numeric", month: "long" })
}

export function turningAge(birthday: string): number | null {
  if (!birthday) return null
  const next = nextBirthday(birthday)
  if (!next) return null
  return next.date.getFullYear() - next.birthYear
}
