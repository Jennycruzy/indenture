"use client";

import Link from "next/link";
import { CloistraShell } from "~~/components/cloistra/CloistraShell";

/* ── small layout primitives for the doc ─────────────────────────────────── */

function Section({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-6 pt-10">
      <div className="ob-section-eyebrow mb-2">{eyebrow}</div>
      <h2 className="ob-display text-2xl md:text-[1.85rem] font-semibold mb-5" style={{ color: "var(--ob-ink)" }}>
        {title}
      </h2>
      <div className="space-y-4 max-w-3xl text-[0.95rem] leading-relaxed" style={{ color: "var(--ob-ink-dim)" }}>
        {children}
      </div>
    </section>
  );
}

function Strong({ children }: { children: React.ReactNode }) {
  return <strong style={{ color: "var(--ob-ink)" }}>{children}</strong>;
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="ob-mono text-[0.85em]">{children}</code>;
}

function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="ob-card p-0 overflow-x-auto not-prose">
      <table className="w-full text-sm">
        <thead>
          <tr>
            {head.map(h => (
              <th
                key={h}
                className="text-left ob-mono text-[0.7rem] uppercase tracking-wider px-4 py-3"
                style={{ color: "var(--ob-ink-faint)", borderBottom: "1px solid var(--ob-line)" }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td
                  key={j}
                  className="px-4 py-2.5 align-top"
                  style={{
                    color: j === 0 ? "var(--ob-ink)" : "var(--ob-ink-dim)",
                    borderBottom: i < rows.length - 1 ? "1px solid var(--ob-line)" : undefined,
                  }}
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const TOC = [
  ["what", "What this is"],
  ["problem", "The problem"],
  ["transfer", "How a transfer crosses"],
  ["rules", "The sealed rulebook"],
  ["visibility", "Who can see what"],
  ["machinery", "The machinery underneath"],
  ["velocity", "The velocity accumulator"],
  ["nullify", "Why failure is silent"],
  ["offramp", "From ciphertext to fiat"],
  ["live", "Live on Sepolia"],
  ["limits", "Limits, stated plainly"],
  ["run", "Run it yourself"],
] as const;

export default function Docs() {
  return (
    <CloistraShell showCorridorBar={false}>
      <div className="ob-grid-mesh relative pt-2">
        <div className="relative z-10">
          <div className="ob-kicker">
            <span className="ob-kicker-dot" /> Documentation
          </div>
          <h1 className="ob-hero-title mt-4" style={{ fontSize: "clamp(2rem, 4.5vw, 3rem)" }}>
            How the sealed corridor works.
          </h1>
          <p className="ob-hero-sub mt-4 max-w-3xl">
            Everything on this page describes code that is deployed, verified, and running on Sepolia. Where a claim has
            a transaction hash behind it, the hash is linked.
          </p>

          <nav className="flex flex-wrap gap-1.5 mt-6">
            {TOC.map(([id, label]) => (
              <a key={id} href={`#${id}`} className="ob-chip no-underline cursor-pointer">
                {label}
              </a>
            ))}
          </nav>
        </div>
      </div>

      <Section id="what" eyebrow="01" title="What this is">
        <p>
          CLOISTRA is a cross-border payment corridor whose <Strong>compliance rulebook is encrypted</Strong>. The cap
          on a single transfer, the list of screened recipients, the ceiling on how much one sender may move per month —
          all of it lives on Ethereum as ciphertext, and every payment is checked against it{" "}
          <Strong>without the chain, the sender, or even the corridor operator ever seeing the thresholds</Strong>.
        </p>
        <p>
          This inverts the usual design. Confidential-payment systems encrypt the <em>amount</em> and publish the{" "}
          <em>rules</em>. CLOISTRA seals the rules themselves, keeps the amounts confidential too, and still gives a
          regulator a lawful way in: one designated compliance officer holds the only decryption rights, granted
          onchain, usable only through a threshold key ceremony.
        </p>
        <p>
          The whole thing runs on fully homomorphic encryption via the FHEVM — contracts compute directly on encrypted
          values. There is no trusted server holding plaintext, no commit-reveal scheme, no mirror database. What the
          chain stores is what exists.
        </p>
      </Section>

      <Section id="problem" eyebrow="02" title="The problem">
        <p>
          Picture a remittance corridor with a published $10,000 per-transfer cap. Nobody launders $10,001 through it.
          They send $9,900, eleven times, from four wallets. Published thresholds are not guardrails — they are
          instructions for how to stay invisible. Regulators call the practice structuring, and it works precisely
          because the boundary is known.
        </p>
        <p>
          Hiding the number is not enough, because rejection leaks. If the corridor <em>refuses</em> a transfer over the
          line, a probing sender can binary-search the cap in a dozen attempts without ever reading it. And even a
          perfectly opaque corridor fails if its own operator can read the risk model — models that staff can read are
          models that leak, to competitors and to the people they are meant to catch.
        </p>
        <p>
          So the requirements stack up to something strange: rules that{" "}
          <Strong>everyone can verify are enforced</Strong>, that <Strong>no one can read</Strong> — not the sender, not
          an observer, not the operator who wrote them — where{" "}
          <Strong>failure is indistinguishable from success</Strong> from the outside, and where{" "}
          <Strong>one auditor can still decrypt specific outcomes</Strong> when the law requires it. That set of
          requirements has exactly one known construction, and it is homomorphic encryption.
        </p>
      </Section>

      <Section id="transfer" eyebrow="03" title="How a transfer crosses">
        <p>A payment moves through the corridor in four steps. None of them exposes a cleartext value onchain.</p>
        <p>
          <Strong>1 — Encrypt.</Strong> The sender types an amount into the browser. The Zama relayer SDK encrypts it
          client-side under the network&rsquo;s public FHE key and produces a zero-knowledge{" "}
          <Strong>input proof</Strong> binding the ciphertext to this sender and this contract. No decryption key exists
          in the browser; the network&rsquo;s secret key exists nowhere at all — it lives sharded across a threshold
          KMS.
        </p>
        <p>
          <Strong>2 — Verify the input.</Strong> Onchain, <Code>FHE.fromExternal</Code> checks the proof. A forged
          ciphertext, or someone replaying another user&rsquo;s ciphertext as their own, reverts here — at the door,
          before any rule is evaluated.
        </p>
        <p>
          <Strong>3 — Adjudicate, encrypted.</Strong> The corridor computes the velocity predicate, then hands the
          engine the sealed amount. The engine folds five encrypted comparisons into one boolean — cap, cumulative
          total, custody, drawdown floor, recipient screening — ANDs in the velocity result, and settles through a
          single <Code>FHE.select(ok, amount, 0)</Code>. The moved amount is either the sender&rsquo;s ciphertext or an
          encrypted zero. There is no branch, so there is nothing to observe: gas, events, and storage writes are
          identical either way.
        </p>
        <p>
          <Strong>4 — Account and receipt.</Strong> The corridor adds the <em>actually-moved</em> ciphertext into the
          sender&rsquo;s encrypted running total, and the engine extends a public hash-chained receipt — proof that a
          settlement happened, and in what order, revealing nothing about what it decided.
        </p>
      </Section>

      <Section id="rules" eyebrow="04" title="The sealed rulebook">
        <Table
          head={["Rule", "What it enforces", "What stays sealed"]}
          rows={[
            [
              "Per-transfer cap",
              "No single payment may exceed the corridor's limit.",
              "The limit, the payment amount, and whether this rule was the one that blocked.",
            ],
            [
              "Recipient screening",
              "Every recipient carries an allow/deny bit, default-deny.",
              "The bit. The recipient address is necessarily public; whether they pass is not.",
            ],
            [
              "Velocity ceiling",
              "A rolling per-sender limit across a public time window.",
              "The ceiling and the sender's running total — sealed even from the sender.",
            ],
            [
              "Custody & drawdown",
              "The corridor cannot move more than it holds, and holdings may not fall below a set fraction of their peak.",
              "The custody balance, the high-water mark, and the drawdown percentage.",
            ],
          ]}
        />
        <p>
          All four evaluate on every transfer, always, in the same order, into the same single boolean. A transfer
          blocked by screening is byte-for-byte indistinguishable from one blocked by velocity — or from one that
          cleared.
        </p>
      </Section>

      <Section id="visibility" eyebrow="05" title="Who can see what">
        <p>
          Decryption is not a matter of trust here; it is a matter of onchain grants. Every ciphertext handle carries an
          access-control list maintained by the FHEVM itself, written by the contracts at the moment each value is
          created.
        </p>
        <Table
          head={["Party", "Can do", "Cannot do"]}
          rows={[
            [
              "Operator",
              "Commit the policy, fund custody, rotate screening bits, set the ceiling.",
              "Read back any policy value it committed. The operator encrypts locally and holds no decrypt grant.",
            ],
            [
              "Sender",
              "Encrypt and submit transfers; see that settlement occurred.",
              "Learn whether its own transfer cleared, where any threshold sits, or its own remaining headroom.",
            ],
            [
              "Corridor contract",
              "Compute on sealed values it was granted — transiently, within one transaction.",
              "Decrypt anything. A contract compute-grant confers no decryption; that requires a granted externally-owned account.",
            ],
            [
              "Compliance officer",
              "Decrypt policy values and per-settlement outcomes, via an EIP-712-signed request through the relayer and threshold KMS.",
              "Move funds or change policy. The audit role is read-only by construction.",
            ],
            [
              "Everyone else",
              "See addresses, timing, nonce order, receipt hashes, and opaque ciphertext handles.",
              "Everything else.",
            ],
          ]}
        />
        <p>
          The operator row is the unusual one, and it is the point: the party with the most operational power has{" "}
          <Strong>zero read access to the policy it administers</Strong>. An insider cannot leak what an insider cannot
          read.
        </p>
      </Section>

      <Section id="machinery" eyebrow="06" title="The machinery underneath">
        <p>
          The contracts are written against <Code>@fhevm/solidity</Code>. Encrypted values are typed —{" "}
          <Code>euint64</Code> for amounts and limits, <Code>ebool</Code> for predicates — and operated on with
          homomorphic primitives: <Code>FHE.le</Code>, <Code>FHE.add</Code>, <Code>FHE.and</Code>,{" "}
          <Code>FHE.select</Code>. The actual FHE computation runs on a coprocessor network; symbolic handles onchain
          commit to every intermediate value. <Code>ZamaEthereumConfig</Code> resolves the host, the ACL, the KMS
          verifier, and the input verifier by chain id, so nothing is hardcoded.
        </p>
        <p>
          Custody is an <Strong>ERC-7984 confidential token</Strong> (OpenZeppelin&rsquo;s FHEVM-native standard), so
          balances and transfer amounts are ciphertext all the way down — the corridor never holds a cleartext number
          even internally.
        </p>
        <p>
          Client-side, the browser uses <Code>@zama-fhe/react-sdk</Code>: <Code>useEncrypt</Code> for input encryption
          and proofs, <Code>useUserDecrypt</Code> for the officer&rsquo;s audit path. The server-side off-ramp uses{" "}
          <Code>@zama-fhe/sdk</Code> with a Node relayer client and a viem-backed signer — the same protocol the browser
          speaks, driven by the officer&rsquo;s key. The Foundry test suite (39 tests) runs on <Code>forge-fhevm</Code>
          &rsquo;s cleartext harness locally; real FHE, relayer, and KMS behavior is exercised on Sepolia.
        </p>
        <p>
          One design decision worth naming: the engine exposes exactly <Strong>one settlement path</Strong>. Every
          consumer contract — the corridor, the single-agent leash, the cross-contract option — funds out through the
          same internal function and the same <Code>FHE.select</Code>. There is no second door to audit.
        </p>
      </Section>

      <Section id="velocity" eyebrow="07" title="The velocity accumulator">
        <p>
          The rolling per-sender limit is the part with real engineering teeth, because a naive version leaks and a
          clever-looking version breaks. The construction:
        </p>
        <p>
          Each sender has an <Strong>encrypted running total</Strong> and a <Strong>public window anchor</Strong>. Block
          timestamps are public information — pretending otherwise would be theater — so the window rollover is a
          plaintext branch on a public clock, which costs nothing and hides nothing that was ever hidden. The amounts
          inside the window are what matter, and those never leave ciphertext.
        </p>
        <p>
          The predicate is <Code>carried + amount ≤ ceiling</Code>, computed homomorphically — an absolute sealed number
          against an absolute sealed number, deliberately avoiding encrypted division, which is where FHE designs go to
          die.
        </p>
        <p>
          The subtle part is what advances the total. The engine returns the sealed <em>moved</em> outcome and grants
          the corridor <Strong>transient compute rights</Strong> on it — compute, not decrypt. The corridor adds{" "}
          <Code>moved</Code>, not the proposed amount, into the accumulator{" "}
          <em>in the same transaction, without ever learning what it added</em>. A transfer nullified by any rule
          contributes an encrypted zero, so a blocked payment cannot eat a sender&rsquo;s window budget. Ciphertext
          flows from one contract&rsquo;s accounting into another&rsquo;s, and no one decrypted anything.
        </p>
      </Section>

      <Section id="nullify" eyebrow="08" title="Why failure is silent">
        <p>
          A corridor that reverts on violation publishes its rulebook one revert at a time. CLOISTRA never reverts on a
          rule breach. The transaction succeeds, the receipt chain extends, events fire — and the moved amount is an
          encrypted zero. The sender sees &ldquo;settled, outcome sealed.&rdquo; So does everyone else.
        </p>
        <p>
          This is what makes probing worthless. Send one transfer or a hundred; walk the amount up or down; nothing in
          gas, logs, storage, or timing distinguishes the transfer that cleared from the one that died. The chain cannot
          tell you where the line is, because the chain itself does not know.
        </p>
        <p>
          Replays and stale submissions do revert — on the public nonce, before any sealed evaluation. Ordering
          integrity is public; policy is not. The distinction between what should be public (that settlement happened,
          in what order) and what must not be (why it resolved the way it did) is drawn deliberately, rule by rule.
        </p>
      </Section>

      <Section id="offramp" eyebrow="09" title="From ciphertext to fiat">
        <p>
          A sealed outcome still has to move money somewhere. A server-side listener runs <em>as</em> the compliance
          officer — the one identity with the decrypt grant. It watches settlement events, user-decrypts each sealed{" "}
          <Code>moved</Code> handle through the relayer and threshold KMS, and calls a payout provider{" "}
          <Strong>only when the decrypted amount is greater than zero</Strong>. A nullified transfer disburses nothing,
          and the listener could not fake it otherwise: the events it watches carry no cleared-or-not bit to shortcut
          on.
        </p>
        <p>
          Payouts run through a Flutterwave v3 adapter (Nigerian naira, bank transfer, sandbox), keyed idempotently to
          the corridor and nonce so one onchain clear can never pay twice — retrying a processed settlement gets
          rejected by reference. The provider sits behind a typed interface; swapping rails touches one file and zero
          contracts.
        </p>
      </Section>

      <Section id="live" eyebrow="10" title="Live on Sepolia">
        <Table
          head={["Contract", "Address"]}
          rows={[
            [
              "Cloistra engine",
              <a
                key="e"
                href="https://sepolia.etherscan.io/address/0xF34694B35841ceA17acc9Fb86D2b5bd3Ac276Eee"
                target="_blank"
                rel="noreferrer"
                className="ob-mono text-xs"
              >
                0xF34694B35841ceA17acc9Fb86D2b5bd3Ac276Eee
              </a>,
            ],
            [
              "DemoConfidentialToken",
              <a
                key="t"
                href="https://sepolia.etherscan.io/address/0x397ce46754a83f9c903c8e53AE9075Bd6D4d67a2"
                target="_blank"
                rel="noreferrer"
                className="ob-mono text-xs"
              >
                0x397ce46754a83f9c903c8e53AE9075Bd6D4d67a2
              </a>,
            ],
            [
              "ConfidentialFeed",
              <a
                key="f"
                href="https://sepolia.etherscan.io/address/0xe9f2C4c32D80bc8Bed243Da4D05bE90b478777A6"
                target="_blank"
                rel="noreferrer"
                className="ob-mono text-xs"
              >
                0xe9f2C4c32D80bc8Bed243Da4D05bE90b478777A6
              </a>,
            ],
            [
              "Corridor",
              <a
                key="c"
                href="https://sepolia.etherscan.io/address/0xD77489caCa9C6549CCeD4A500B46019BE2d225c4"
                target="_blank"
                rel="noreferrer"
                className="ob-mono text-xs"
              >
                0xD77489caCa9C6549CCeD4A500B46019BE2d225c4
              </a>,
            ],
          ]}
        />
        <p>
          The demo token in this corridor is <Code>clUSD</Code>, an ERC-7984 confidential token minted on Sepolia for
          custody testing. The operator pre-funds sealed custody with that token; the sender does not receive a visible
          balance and submits only an encrypted amount. In the sandbox off-ramp, decrypted <Code>moved</Code> units map
          1:1 to NGN for evidence capture.
        </p>
        <p>
          All four contracts are verified on Etherscan. The full loop has been closed more than once — an encrypted
          transfer clearing every sealed rule onchain, officer-decrypted through the KMS, and disbursed as a successful
          sandbox payout — most recently at{" "}
          <a
            href="https://sepolia.etherscan.io/tx/0x0a3da67bd1e87d29f151a115a18786c8282f990dbc98318af6042da69decbfb1"
            target="_blank"
            rel="noreferrer"
          >
            nonce 12
          </a>
          , decrypted to <Code>moved = 100 clUSD</Code> and paid as 100 NGN (provider reference{" "}
          <Code>…-12_PMCKDU_1</Code>, status SUCCESSFUL). Per-transaction evidence, blocks, and gas figures live in the
          repository&rsquo;s <Code>DEPLOYMENTS.md</Code>.
        </p>
      </Section>

      <Section id="limits" eyebrow="11" title="Limits, stated plainly">
        <p>
          The contracts are unaudited and hold demo value on a testnet. The fiat leg is a licensed provider&rsquo;s{" "}
          <em>sandbox</em>: it proves the integration end to end, and it is not production money movement — that
          requires a live provider account, a funded float, and the compliance approvals that come with both.
        </p>
        <p>
          Some things are public on purpose and should be understood as such: addresses, transaction timing, nonce
          ordering, and window anchors. FHE hides values, not traffic patterns. The single-sender demo configuration
          also trades a deliberately generous velocity ceiling for repeatability; a production corridor would keep it
          tight and rely on each sender having their own window.
        </p>
        <p>
          And the trust model is explicit: confidentiality rests on the FHEVM&rsquo;s coprocessor, ACL, and threshold
          KMS. That is a far smaller and more inspectable surface than &ldquo;trust the operator&rsquo;s
          database,&rdquo; but it is not zero, and pretending otherwise would be the kind of claim this page exists to
          avoid.
        </p>
      </Section>

      <Section id="run" eyebrow="12" title="Run it yourself">
        <p>
          One command builds the contracts, runs all 39 Foundry tests, typechecks the frontend and the off-ramp, and
          checks formatting:
        </p>
        <div className="ob-card p-4 ob-mono text-sm" style={{ color: "var(--ob-ink)" }}>
          pnpm install && pnpm contracts:install
          <br />
          pnpm cloistra:gate
        </div>
        <p>
          Then <Code>pnpm start</Code> serves this app. The <Link href="/operator">operator</Link>,{" "}
          <Link href="/sender">sender</Link>, and <Link href="/officer">officer</Link> consoles each take one seat at
          the corridor; the scout&rsquo;s-eye toggle in the header shows any page as an outside observer sees it — which
          is to say, sealed.
        </p>
      </Section>

      <footer className="ob-card p-5 mt-12">
        <p className="text-sm leading-relaxed" style={{ color: "var(--ob-ink-dim)" }}>
          <span className="ob-mono ob-audit-text">source:</span> contracts, frontend, off-ramp, tests, and deployment
          evidence are in the repository. The design document (<Code>CLOISTRA_DESIGN.md</Code>) records the rationale
          behind each sealing decision; <Code>VERIFICATION.md</Code> defines the gate every change must pass.
        </p>
      </footer>
    </CloistraShell>
  );
}
