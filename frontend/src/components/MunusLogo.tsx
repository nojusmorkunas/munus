import { cn } from "@/lib/utils"

// Munus logo: a present whose bow is a lowercase m. Path data comes from the
// masters in docs/brand; the symbol is always rose, the wordmark follows the
// text colour so it works in light and dark mode.

const ROSE = "#E11D48"

const SYMBOL =
  "M46 97H117V133H46A10 10 0 0 1 36 123V107A10 10 0 0 1 46 97ZM139 97H210A10 10 0 0 1 220 107V123A10 10 0 0 1 210 133H139ZM60 143H117V223H60A10 10 0 0 1 50 213V153A10 10 0 0 1 60 143ZM139 143H196A10 10 0 0 1 206 153V213A10 10 0 0 1 196 223H139ZM65 87V66A37 37 0 0 1 128 39.68A37 37 0 0 1 191 66V87H169V66A15 15 0 0 0 139 66V87H117V66A15 15 0 0 0 87 66V87Z"

const WORDMARK_HORIZONTAL =
  "M280.32 182 V115.38 A37.38 37.38 0 0 1 343.69 88.52 A37.38 37.38 0 0 1 407.07 115.38 V182 H384.32 V115.38 A14.62 14.62 0 0 0 355.07 115.38 V182 H332.32 V115.38 A14.62 14.62 0 0 0 303.07 115.38 V182ZM423.32 78 H446.07 V144.62 A14.62 14.62 0 0 0 475.32 144.62 V78 H498.07 V144.62 A37.38 37.38 0 0 1 423.32 144.62ZM514.32 182 V115.38 A37.38 37.38 0 0 1 589.07 115.38 V182 H566.32 V115.38 A14.62 14.62 0 0 0 537.07 115.38 V182ZM605.32 78 H628.07 V144.62 A14.62 14.62 0 0 0 657.32 144.62 V78 H680.07 V144.62 A37.38 37.38 0 0 1 605.32 144.62ZM753.48 96.3 A31.69 31.69 0 1 0 724.76 141.38 A8.94 8.94 0 1 1 716.66 154.09 L696.04 163.7 A31.69 31.69 0 1 0 724.76 118.62 A8.94 8.94 0 1 1 732.86 105.91Z"

const WORDMARK_STACKED =
  "M4.94 312.76 V278.32 A19.32 19.32 0 0 1 37.7 264.44 A19.32 19.32 0 0 1 70.46 278.32 V312.76 H58.7 V278.32 A7.56 7.56 0 0 0 43.58 278.32 V312.76 H31.82 V278.32 A7.56 7.56 0 0 0 16.7 278.32 V312.76ZM78.86 259 H90.62 V293.44 A7.56 7.56 0 0 0 105.74 293.44 V259 H117.5 V293.44 A19.32 19.32 0 0 1 78.86 293.44ZM125.9 312.76 V278.32 A19.32 19.32 0 0 1 164.54 278.32 V312.76 H152.78 V278.32 A7.56 7.56 0 0 0 137.66 278.32 V312.76ZM172.94 259 H184.7 V293.44 A7.56 7.56 0 0 0 199.82 293.44 V259 H211.58 V293.44 A19.32 19.32 0 0 1 172.94 293.44ZM249.53 268.46 A16.38 16.38 0 1 0 234.68 291.76 A4.62 4.62 0 1 1 230.49 298.33 L219.83 303.3 A16.38 16.38 0 1 0 234.68 280 A4.62 4.62 0 1 1 238.87 273.43Z"

interface LogoProps {
  className?: string
}

/** The symbol on its own. */
export function MunusMark({ className }: LogoProps) {
  return (
    <svg viewBox="36 29 184 194" role="img" aria-label="Munus" className={cn("h-6 w-auto", className)}>
      <path fill={ROSE} d={SYMBOL} />
    </svg>
  )
}

/** Symbol and wordmark, side by side (default) or stacked. */
export function MunusLogo({ className, stacked = false }: LogoProps & { stacked?: boolean }) {
  return (
    <svg
      viewBox={stacked ? "4.94 29 246.12 283.76" : "36 29 720.44 194"}
      role="img"
      aria-label="Munus"
      className={cn("h-7 w-auto", className)}
    >
      <path fill={ROSE} d={SYMBOL} />
      <path fill="currentColor" d={stacked ? WORDMARK_STACKED : WORDMARK_HORIZONTAL} />
    </svg>
  )
}
