export function Metrics({
  items,
}: {
  items: { label: string; value: string; warn?: boolean }[]
}) {
  return (
    <ul className="app-metrics">
      {items.map((m) => (
        <li key={m.label}>
          <p className="font-mono text-[11px] tracking-[0.16em] text-muted">{m.label}</p>
          <p className={`mt-2 text-[1.35rem] font-semibold ${m.warn ? 'text-danger' : 'text-white'}`}>{m.value}</p>
        </li>
      ))}
    </ul>
  )
}
// ok
