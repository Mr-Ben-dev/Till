import { Outlet, useLocation } from 'react-router-dom'
import { Nav } from './components/Nav'
import { useTill } from './hooks/useTill'

export function AppShell() {
  const till = useTill()
  const landing = useLocation().pathname === '/'
  const docs = useLocation().pathname.startsWith('/developers')
  return (
    <div className={`min-h-[100dvh] text-white ${landing ? 'bg-navy' : 'bg-navy-deep'}`}>
      {landing || docs ? null : <div className="grain" />}
      <Nav
        ready={till.ready}
        authenticated={till.authenticated}
        address={till.address}
        onConnect={till.login}
        onLogout={till.logout}
      />
      <Outlet context={till} />
    </div>
  )
}
