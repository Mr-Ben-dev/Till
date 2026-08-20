export function ActionCard({
  what,
  why,
  next,
  children,
}: {
  what: string
  why: string
  next: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-[4.27px] border border-white/10 bg-white/[0.03] p-6 md:p-8">
      <h2 className="text-[1.5rem] font-bold leading-tight text-white">{what}</h2>
      <p className="mt-3 max-w-[55ch] text-[15px] leading-relaxed text-white/70">{why}</p>
      <p className="mt-2 max-w-[55ch] text-[14px] text-white/50">{next}</p>
      <div className="mt-6">{children}</div>
    </section>
  )
}
// ok
