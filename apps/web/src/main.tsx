import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes, useOutletContext } from 'react-router-dom'
import { PrivyProvider } from '@privy-io/react-auth'
import { AppShell } from './App'
import { HomePage } from './pages/Home'
import { TillPage } from './pages/TillPage'
import { AgentsPage } from './pages/AgentsPage'
import { JobsPage } from './pages/JobsPage'
import { ActivityPage } from './pages/ActivityPage'
import { VerifyPage } from './pages/VerifyPage'
import { ogAristotle } from './lib/chain'
import type { TillState } from './hooks/useTill'
import './index.css'

const appId = import.meta.env.VITE_PRIVY_APP_ID

function TillRoute() {
  const till = useOutletContext<TillState>()
  return <TillPage till={till} />
}
function AgentsRoute() {
  const till = useOutletContext<TillState>()
  return <AgentsPage till={till} />
}
function JobsRoute() {
  const till = useOutletContext<TillState>()
  return <JobsPage till={till} />
}
function ActivityRoute() {
  const till = useOutletContext<TillState>()
  return <ActivityPage till={till} />
}

function RoutesTree() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/till" element={<TillRoute />} />
        <Route path="/agents" element={<AgentsRoute />} />
        <Route path="/jobs" element={<JobsRoute />} />
        <Route path="/activity" element={<ActivityRoute />} />
        <Route path="/verify" element={<VerifyPage />} />
      </Route>
    </Routes>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ['wallet', 'email'],
        appearance: {
          theme: 'dark',
          accentColor: '#00BDE9',
          logo: '/brand/till-logo-mark.png',
          walletList: ['detected_wallets', 'metamask', 'wallet_connect'],
        },
        defaultChain: ogAristotle,
        supportedChains: [ogAristotle],
        embeddedWallets: {
          ethereum: { createOnLogin: 'users-without-wallets' },
        },
      }}
    >
      <BrowserRouter>
        <RoutesTree />
      </BrowserRouter>
    </PrivyProvider>
  </StrictMode>
)
