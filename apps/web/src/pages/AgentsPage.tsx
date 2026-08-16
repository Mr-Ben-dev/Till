import type { TillState } from '../hooks/useTill'
import { CyanButton } from '../components/CyanButton'
import { Notice } from '../components/app/Notice'
import { fmt0g, shortAddr } from '../lib/errors'
import { txUrl } from '../lib/chain'

export function AgentsPage({ till }: { till: TillState }) {
  const ready = till.authorized.length > 0
  return (
    <main className="app-page">
      <h1 className="text-[clamp(1.8rem,3.2vw,2.8rem)] font-bold leading-tight">Agents</h1>
      <p className="mt-3 max-w-[54ch] text-[16px] leading-relaxed text-white/65">
        An agent is a grant on your Till. It can spend inside the cap. It cannot empty you.
      </p>
      {till.error && <div className="mt-6"><Notice tone="danger" title="Stopped" body={till.error} /></div>}
      {till.busy && <p className="mt-6 font-mono text-[12px] text-cyan">{till.busy}</p>}

      {!till.tokenId ? (
        <div className="mt-10">
          <Notice
            title="No Till yet"
            body="Create a Till first. Then attach an agent."
            action={<CyanButton to="/till">Open Till</CyanButton>}
          />
        </div>
      ) : (
        <section className="mt-10 rounded-[4.27px] border border-white/10 p-6 md:p-8">
          <p className="font-mono text-[11px] tracking-[0.16em] text-muted">
            {ready ? 'Agent ready' : 'No grant yet'}
          </p>
          <h2 className="mt-3 text-[1.4rem] font-bold">
            {till.agentOf ? shortAddr(till.agentOf.address) : 'Owner-run'}
          </h2>
          <dl className="mt-6 grid gap-3 text-[14px] text-white/75 md:grid-cols-2">
            <div>
              <dt className="text-muted">Till</dt>
              <dd>#{till.tokenId.toString()}</dd>
            </div>
            <div>
              <dt className="text-muted">Status</dt>
              <dd>{till.paused ? 'Paused' : ready ? 'Authorized' : 'Owner only'}</dd>
            </div>
            <div>
              <dt className="text-muted">Capabilities</dt>
              <dd>Pay allowed work. Jobs. No withdraw. No policy change.</dd>
            </div>
            <div>
              <dt className="text-muted">Session gas</dt>
              <dd>{till.agentOf ? fmt0g(till.agentGas) : 'n/a'}</dd>
            </div>
            <div>
              <dt className="text-muted">Spend this window</dt>
              <dd>{fmt0g(till.windowSpentWei)}</dd>
            </div>
            <div>
              <dt className="text-muted">Grant</dt>
              <dd>{ready ? 'Active on this Till' : 'None. Owner can still pay.'}</dd>
            </div>
          </dl>
          <div className="mt-8 flex flex-wrap gap-3">
            {!ready && (
              <CyanButton disabled={!!till.busy} onClick={till.attachAgent}>
                Create agent
              </CyanButton>
            )}
            <CyanButton to="/till">Run</CyanButton>
            {till.lastTx && (
              <CyanButton variant="ghost" href={txUrl(till.lastTx)}>
                View proof
              </CyanButton>
            )}
            <CyanButton variant="ghost" disabled={!!till.busy} onClick={() => till.pause(!till.paused)}>
              {till.paused ? 'Unpause' : 'Pause'}
            </CyanButton>
          </div>
          {till.authorized.length > 0 && (
            <ul className="mt-8 divide-y divide-white/10 border-t border-white/10">
              {till.authorized.map((a) => (
                <li key={a} className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <span className="font-mono text-[12px] text-white/70">{a}</span>
                  <button
                    type="button"
                    className="text-[14px] text-danger"
                    onClick={() => till.revokeAgent(a)}
                  >
                    Revoke
                  </button>
                </li>
              ))}
            </ul>
          )}
          {till.agentOf && till.agentGas === 0n && (
            <div className="mt-6">
              <Notice
                title="This session key has no gas"
                body="It is device-local and scoped to this Till. If it signs itself, send a small amount of 0G for fees. It still cannot withdraw."
                action={
                  <CyanButton disabled={!!till.busy} onClick={() => till.fundAgentGas('0.002')}>
                    Send gas
                  </CyanButton>
                }
              />
            </div>
          )}
        </section>
      )}
      <details className="mt-8 text-[13px] text-white/45">
        <summary className="cursor-pointer">Technical details</summary>
        <p className="mt-3 max-w-[54ch] leading-relaxed">
          Session keys stay in this browser, scoped to this Till. ERC-8004 Identity and Reputation are live.
          Validation Registry is not claimed.
        </p>
      </details>
    </main>
  )
}
