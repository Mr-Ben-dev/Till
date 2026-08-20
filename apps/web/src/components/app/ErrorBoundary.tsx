import { Component, type ErrorInfo, type ReactNode } from 'react'
import { CyanButton } from '../CyanButton'

type Props = { children: ReactNode }
type State = { err: string | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { err: null }

  static getDerivedStateFromError(error: unknown): State {
    const msg = error instanceof Error ? error.message : 'This view crashed.'
    return { err: msg }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.warn('Till view error', error, info.componentStack)
  }

  render() {
    if (!this.state.err) return this.props.children
    return (
      <main className="app-page">
        <h1 className="text-[clamp(1.6rem,3vw,2.2rem)] font-bold">This Till could not be shown</h1>
        <p className="mt-3 max-w-[54ch] text-[15px] text-white/65">
          The previous screen closed because of a view error. Reload this Till. Your funds and policy on Aristotle are unchanged.
        </p>
        <p className="mt-4 font-mono text-[12px] text-white/40">{this.state.err}</p>
        <div className="mt-6">
          <CyanButton
            onClick={() => {
              this.setState({ err: null })
              window.location.reload()
            }}
          >
            Reload
          </CyanButton>
        </div>
      </main>
    )
  }
}
