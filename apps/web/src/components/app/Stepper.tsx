import { ONBOARD } from '../../lib/human'

export function Stepper({ current }: { current: number }) {
  return (
    <ol className="app-stepper" aria-label="Setup">
      {ONBOARD.map((s, i) => {
        const done = i < current
        const on = i === current
        return (
          <li key={s.id} className={done ? 'is-done' : on ? 'is-on' : ''}>
            <span className="app-stepper__dot" />
            <span>{s.label}</span>
          </li>
        )
      })}
    </ol>
  )
}
