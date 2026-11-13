// Who suggested an item and what they wrote, shown in full. Used wherever the
// list owner is looking at one item (the suggestion card, the item dialog and
// the Add to my list form). List rows use the smaller SuggestionHint icon instead.
export default function SuggestionNote({ name, note }: { name: string; note?: string }) {
  return (
    <div className="rounded-md border border-amber-200/80 bg-amber-50/60 px-3 py-2 dark:border-amber-900/50 dark:bg-amber-950/20">
      <p className="text-xs font-medium text-muted-foreground">Suggested by {name || "someone"}</p>
      {note && <p className="text-sm leading-snug mt-0.5">“{note}”</p>}
    </div>
  )
}
