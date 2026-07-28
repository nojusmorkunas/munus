import { AlertTriangle } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface Props {
  status: string
  checkedAt: string
  detail?: boolean
}

function checkedLabel(checkedAt: string) {
  if (!checkedAt) return ""
  const date = new Date(checkedAt)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleString()
}

export default function AvailabilityNotice({ status, checkedAt, detail = false }: Props) {
  if (status !== "unavailable") return null

  const checked = checkedLabel(checkedAt)
  const explanation = `The saved product page appeared sold out or unavailable${checked ? ` when checked ${checked}` : ""}. The item may still be available from another page or seller.`

  if (detail) {
    return (
      <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
        <div className="flex items-center gap-1.5 font-medium">
          <AlertTriangle size={15} />
          May be unavailable at this link
        </div>
        <p className="mt-1 text-xs leading-relaxed opacity-90">{explanation}</p>
      </div>
    )
  }

  return (
    <Badge
      variant="outline"
      className="border-amber-300 bg-amber-50 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
      title={explanation}
    >
      <AlertTriangle size={11} className="mr-1" />
      May be unavailable here
    </Badge>
  )
}
