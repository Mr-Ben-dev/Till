import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes, useOutletContext, useSearchParams } from 'react-router-dom'
import { PrivyProvider } from '@privy-io/react-auth'
import { AppShell } from './App'
import { HomePage } from './pages/Home'
import { TillsPage } from './pages/TillsPage'
import { CreateTillPage } from './pages/CreateTillPage'
import { TillPage } from './pages/TillPage'
import { MissionPage } from './pages/MissionPage'
import { PolicyPage } from './pages/PolicyPage'
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

function useTillCtx() {
  return useOutletContext<TillState>()
}

function TillsRoute() {
  return <TillsPage till={useTillCtx()} />
}
function CreateTillRoute() {
  return <CreateTillPage till={useTillCtx()} />
}
function TillRoute() {
  return <TillPage till={useTillCtx()} />
}
function MissionRoute() {
  return <MissionPage till={useTillCtx()} />
}
function PolicyRoute() {
  return <PolicyPage till={useTillCtx()} />
}
function AgentsRoute() {
  return <AgentsPage till={useTillCtx()} />
}
function JobsRoute() {
  return <JobsPage till={useTillCtx()} />
}
function ActivityRoute() {
  return <ActivityPage till={useTillCtx()} />
}
function DocsRoute() {
  return <DocsShell till={useTillCtx()} />
}

function RedirectAgents() {
  const [params] = useSearchParams()
  const q = params.toString()
  return <Navigate to={q ? `/till/agent?${q}` : '/till/agent'} replace />
}

function RoutesTree() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/tills" element={<TillsRoute />} />
        <Route path="/tills/new" element={<CreateTillRoute />} />
        <Route path="/till" element={<TillRoute />} />
        <Route path="/till/mission" element={<MissionRoute />} />
        <Route path="/till/policy" element={<PolicyRoute />} />
        <Route path="/till/agent" element={<AgentsRoute />} />
        <Route path="/agents" element={<RedirectAgents />} />
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
