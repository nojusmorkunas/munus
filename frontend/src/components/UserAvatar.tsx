import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { AVATAR_SHAPE, fallbackPresetUrl } from "@/lib/avatars"

interface Props {
  user: { displayName: string; avatarUrl: string }
  className?: string
}

export default function UserAvatar({ user, className = "w-9 h-9" }: Props) {
  const [imgFailed, setImgFailed] = useState(false)
  // A new picture gets a fresh try, even if the last one failed to load.
  useEffect(() => setImgFailed(false), [user.avatarUrl])

  // The server gives everyone without a picture a preset, so this fallback
  // only shows for a photo that won't load (or an older server). It's still an
  // animal, so nobody ends up with a blank square.
  const src = user.avatarUrl && !imgFailed ? user.avatarUrl : fallbackPresetUrl(user.displayName)

  return (
    <img
      src={src}
      alt={user.displayName}
      className={cn(AVATAR_SHAPE, "object-cover shrink-0 bg-muted", className)}
      onError={() => setImgFailed(true)}
    />
  )
}
