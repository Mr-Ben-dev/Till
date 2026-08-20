export type Denial = {
  amount: string
  why: string
  policy: boolean
  tee: boolean
  funds: boolean
}

export function DenialCard({ denial }: { denial: Denial }) {
  return (
    <section className="rounded-[4.27px] border border-danger/35 bg-danger/10 p-6">
      <p className="font-mono text-[11px] tracking-[0.18em] text-danger">BLOCKED</p>
      <h3 className="mt-3 text-[1.4rem] font-bold leading-tight text-white">
        This spend of {denial.amount} was blocked.
      </h3>
      <p className="mt-3 max-w-[50ch] text-[15px] leading-relaxed text-white/75">Why: {denial.why}</p>
      <ul className="mt-5 grid gap-2 text-[14px] text-white/80">
        <li>Policy {denial.policy ? 'held' : 'stopped this'}</li>
        <li>TEE {denial.tee ? 'was not the failure' : 'rejected the digest'}</li>
        <li>Funds {denial.funds ? 'are still in your Till' : 'could not be confirmed'}</li>
      </ul>
      <p className="mt-4 text-[14px] text-white/60">The system protected you. Nothing left the vault.</p>
    </section>
  )
}
// note
