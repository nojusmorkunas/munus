// The preset avatar illustrations in public/avatars. Keep this in step with
// PresetAvatars in backend/db/avatars.go, which hands out the defaults.
export const PRESET_AVATARS = [
  "fox", "cat", "bear", "panda", "rabbit", "owl",
  "frog", "penguin", "koala", "lion", "dog", "mouse",
  "pig", "raccoon", "tiger", "chick", "monkey", "sheep",
  "deer", "elephant", "hedgehog", "otter", "sloth", "giraffe",
  "cow", "hamster", "unicorn", "dinosaur", "axolotl", "redpanda",
] as const

export function presetUrl(name: string) {
  return `/avatars/${name}.svg`
}

export function isPresetUrl(url: string) {
  return PRESET_AVATARS.some((name) => presetUrl(name) === url)
}

export function presetLabel(name: string) {
  if (name === "redpanda") return "Red panda"
  return name.charAt(0).toUpperCase() + name.slice(1)
}

/** A stable preset picked from a name, for when no picture is available. */
export function fallbackPresetUrl(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0
  return presetUrl(PRESET_AVATARS[Math.abs(h) % PRESET_AVATARS.length])
}

export function randomPresetUrl() {
  return presetUrl(PRESET_AVATARS[Math.floor(Math.random() * PRESET_AVATARS.length)])
}

/** Rounded square for every avatar, so photos and illustrations match. */
export const AVATAR_SHAPE = "rounded-[28%]"
