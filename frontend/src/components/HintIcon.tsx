import { useRef, useState, type ReactNode } from "react"
import { Popover } from "radix-ui"
import { Gift, Info, Lightbulb } from "lucide-react"
import { cn } from "@/lib/utils"

interface HintIconProps {
  /** Screen reader name for the icon, e.g. "Suggested by Alex". */
  label: string
  icon?: "info" | "suggestion" | "gift"
  /** The full text, shown on hover with a mouse or on tap on a phone. */
  children: ReactNode
  className?: string
}

// A small icon that shows extra detail on hover (mouse) or tap (touch), so the
// detail doesn't need its own line of subtext.
export function HintIcon({ label, icon = "info", children, className }: HintIconProps) {
  const [open, setOpen] = useState(false)
  const pointerType = useRef("")
  const Icon = icon === "suggestion" ? Lightbulb : icon === "gift" ? Gift : Info

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={label}
          className={cn(
            "inline-flex items-center justify-center shrink-0 rounded-full p-1 -m-1 outline-none focus-visible:ring-2 focus-visible:ring-ring",
            icon === "suggestion"
              ? "text-amber-500 hover:text-amber-600"
              : icon === "gift"
                ? "text-green-600 hover:text-green-700 dark:text-green-400"
                : "text-muted-foreground hover:text-foreground",
            className
          )}
          onPointerEnter={(e) => { if (e.pointerType === "mouse") setOpen(true) }}
          onPointerLeave={(e) => { if (e.pointerType === "mouse") setOpen(false) }}
          onPointerDown={(e) => { pointerType.current = e.pointerType }}
          onClick={(e) => {
            // Don't let the tap also open the row or card the icon sits in.
            e.stopPropagation()
            // A mouse already opened it by hovering, so a click shouldn't close it.
            if (pointerType.current === "mouse") e.preventDefault()
            pointerType.current = ""
          }}
        >
          <Icon size={14} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          sideOffset={6}
          collisionPadding={12}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          className="z-[70] max-w-[260px] rounded-md bg-foreground px-3 py-2 text-xs font-normal leading-snug text-background shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
        >
          {children}
          <Popover.Arrow className="fill-foreground" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

// Marks an item that someone suggested. Only list owners get the name, so only
// they see this.
export function SuggestionHint({ name, note }: { name: string; note?: string }) {
  return (
    <HintIcon icon="suggestion" label={`Suggested by ${name}`}>
      <p className="font-semibold">Suggested by {name}</p>
      {note && <p className="mt-0.5 opacity-80">“{note}”</p>}
    </HintIcon>
  )
}
