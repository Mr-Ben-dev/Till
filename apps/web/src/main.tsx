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
import { DocsShell, DocsOauth } from './pages/docs/DocsShell'
import {
  DocsArchitecture,
  DocsClaude,
  DocsContracts,
  DocsCore,
  DocsCursor,
  DocsMcp,
  DocsOverview,
  DocsProof,
  DocsQuickstart,
  DocsReference,
  DocsSdk,
  DocsSecurity,
} from './pages/docs/DocsPages'
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
function DocsRoute() {
  const till = useOutletContext<TillState>()
  return <DocsShell till={till} />
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
        <Route path="/developers" element={<DocsRoute />}>
          <Route index element={<DocsOverview />} />
          <Route path="quickstart" element={<DocsQuickstart />} />
          <Route path="core" element={<DocsCore />} />
          <Route path="mcp" element={<DocsMcp />} />
          <Route path="cursor" element={<DocsCursor />} />
          <Route path="claude" element={<DocsClaude />} />
          <Route path="sdk" element={<DocsSdk />} />
          <Route path="architecture" element={<DocsArchitecture />} />
          <Route path="proof" element={<DocsProof />} />
          <Route path="reference" element={<DocsReference />} />
          <Route path="contracts" element={<DocsContracts />} />
          <Route path="security" element={<DocsSecurity />} />
          <Route path="oauth" element={<DocsOauth />} />
        </Route>
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
