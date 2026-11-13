import { useEffect, useState } from "react"
import { Gift } from "lucide-react"
import { cn } from "@/lib/utils"

interface Props {
  src: string
  className?: string
  onClick?: () => void
}

// Items without a photo get a placeholder tile so every row lines up.
export default function ItemThumb({ src, className, onClick }: Props) {
  const [failed, setFailed] = useState(false)

  useEffect(() => setFailed(false), [src])

  const base = cn(
    "w-12 h-12 rounded-md shrink-0 bg-muted",
    onClick && "cursor-pointer",
    className
  )

  if (!src || failed) {
    return (
      <div className={cn(base, "flex items-center justify-center")} onClick={onClick} aria-hidden>
        <Gift size={18} className="text-muted-foreground/50" />
      </div>
    )
  }

  return (
    <img
      src={src}
      alt=""
      className={cn(base, "object-cover")}
      onClick={onClick}
      onError={() => setFailed(true)}
    />
  )
}
