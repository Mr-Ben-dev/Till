import { Outlet, useLocation } from 'react-router-dom'
import { Nav } from './components/Nav'
import { ErrorBoundary } from './components/app/ErrorBoundary'
import { TillContextBar } from './components/app/TillContextBar'
import { useTill } from './hooks/useTill'

export function AppShell() {
  const till = useTill()
  const path = useLocation().pathname
  const landing = path === '/'
  const docs = path.startsWith('/developers')
  const collection = path === '/tills' || path.startsWith('/tills/')
  const product = !landing && !docs && !collection && path !== '/verify'
  return (
    <div className={`min-h-[100dvh] text-white ${landing ? 'bg-navy' : 'bg-navy-deep'}`}>
      {landing || docs ? null : <div className="grain grain--soft" />}
      <Nav
        ready={till.ready}
        authenticated={till.authenticated}
        address={till.address}
        onConnect={till.login}
        onLogout={till.logout}
      />
      {product ? <TillContextBar till={till} /> : null}
      <ErrorBoundary key={till.tokenId?.toString() ?? 'none'}>
        <Outlet context={till} />
      </ErrorBoundary>
    </div>
  )
}
