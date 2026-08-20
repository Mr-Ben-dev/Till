import { useNavigate } from 'react-router-dom'
import type { TillState } from '../hooks/useTill'
import { CyanButton } from '../components/CyanButton'
import { ActionCard } from '../components/app/ActionCard'
import { ProductNotices } from '../components/app/ProductNotices'
import { MyTills } from '../components/app/SessionPanel'
import { TillSkeleton } from '../components/app/TillContextBar'

export function TillsPage({ till }: { till: TillState }) {
  const nav = useNavigate()
  const loading = till.authenticated && !till.loadError && !till.hydrated
  return (
    <main className="app-page overflow-x-hidden w-full max-w-full">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[clamp(1.8rem,3.2vw,2.8rem)] font-bold leading-tight">Your spending accounts</h1>
          <p className="mt-3 max-w-[54ch] text-[16px] leading-relaxed text-white/65">
            Each Till is a separate protected budget for autonomous work.
          </p>
        </div>
        {till.authenticated ? (
          <CyanButton to="/tills/new">Create a Till</CyanButton>
        ) : null}
      </div>
      <div className="mt-8">
        <ProductNotices till={till} />
      </div>
      {!till.authenticated ? (
        <div className="mt-10">
          <ActionCard
            what="Connect your wallet"
            why="Confirm the URL is till-0g.vercel.app. MetaMask often warns on *.vercel.app hosts. That warning is Blockaid, not a Privy misconfig."
            next="Then create a Till. Your keys stay in the wallet."
          >
            <CyanButton onClick={till.login}>Connect</CyanButton>
          </ActionCard>
        </div>
      ) : loading ? (
        <TillSkeleton label="Loading your Tills from Aristotle…" />
      ) : !till.tokenIds.length ? (
        <section className="surf surf-accent mt-10">
          <h2>Create a Till</h2>
          <p className="mod-lede">You are creating a separate protected spending account. The agent never receives this wallet.</p>
          <div className="mt-5">
            <CyanButton to="/tills/new">Create a Till</CyanButton>
          </div>
        </section>
      ) : (
        <div className="mt-10">
          <MyTills
            till={till}
            onOpen={(id) => {
              till.selectTill(id)
              nav('/till')
            }}
          />
        </div>
      )}
    </main>
  )
}
