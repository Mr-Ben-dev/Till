export function CanCannot({
  can,
  cannot,
}: {
  can: string[]
  cannot: string[]
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="rounded-[4.27px] bg-white/[0.04] p-5">
        <h3 className="text-[15px] font-semibold text-cyan">What your agent can do</h3>
        <ul className="mt-3 grid gap-2 text-[14px] leading-relaxed text-white/80">
          {can.map((t) => (
            <li key={t}>
              <span className="mr-2 text-cyan">✓</span>
              {t}
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-[4.27px] bg-white/[0.04] p-5">
        <h3 className="text-[15px] font-semibold text-danger">What it cannot do</h3>
        <ul className="mt-3 grid gap-2 text-[14px] leading-relaxed text-white/80">
          {cannot.map((t) => (
            <li key={t}>
              <span className="mr-2 text-danger">✕</span>
              {t}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
// todo
