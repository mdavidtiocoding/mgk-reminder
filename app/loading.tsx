export default function Loading() {
  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row" aria-busy="true">
      <aside className="hidden h-svh w-[220px] shrink-0 border-r bg-sidebar md:block" />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 p-6">
        <div className="h-5 w-40 animate-pulse rounded bg-muted" />
        <div className="h-4 w-64 animate-pulse rounded bg-muted" />
        <div className="mt-2 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl border bg-muted/40" />
          ))}
        </div>
      </main>
    </div>
  )
}
