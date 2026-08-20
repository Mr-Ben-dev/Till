import { useState } from 'react'

export function CopyBlock({ label, value }: { label?: string; value: string }) {
  const [done, setDone] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(value)
    setDone(true)
    window.setTimeout(() => setDone(false), 1600)
  }
  return (
    <div className="docs-copy">
      {label ? <p className="docs-copy__label">{label}</p> : null}
      <pre>
        <code>{value}</code>
      </pre>
      <button type="button" onClick={() => void copy()}>
        {done ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}
