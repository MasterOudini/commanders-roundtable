# Game Engine + Networking — design spec (M3/M4)

> Produced during the planning session on 2026-07-26 and preserved here verbatim.
> This is a DESIGN SPEC, not a record of what is built — check AGENTS.md
> "Milestone status" for what actually exists, and docs/DECISIONS.md for places
> where implementation deliberately diverged from this document.

---

```ts
export interface StaticDef {
  readonly abilityId: string;
  readonly text: string;
  readonly layer: 'type' | 'color' | 'ability' | 'cda' | 'ptSet' | 'ptModify' | 'ptSwitch';
  readonly activeZones: readonly ZoneKind[];                      // usually ['battlefield']
  readonly appliesTo: (ctx: ScriptCtx, self: InstanceId, candidate: InstanceId) => boolean;
  readonly modify: (chars: MutableCharacteristics, ctx: ScriptCtx, self: InstanceId, candidate: InstanceId) => void;
}

export interface ReplacementDef {
  readonly abilityId: string;
  readonly text: string;
  readonly activeZones: readonly ZoneKind[];
  readonly applies: (ctx: ScriptCtx, self: InstanceId, ev: EventBody) => boolean;
  /** Return [] to prevent entirely; return a modified/expanded list to replace. Must not re-trigger itself. */
  readonly replace: (ctx: ScriptCtx, self: InstanceId, ev: EventBody) => readonly EventBody[];
}

export interface CastRestrictionDef {
  readonly abilityId: string;
  readonly text: string;
  readonly allows: (ctx: ScriptCtx, self: InstanceId, from: ZoneRef) => boolean;
}

export interface ScriptRegistry {
  get(oracleId: OracleId): CardScript | undefined;
  /** Pre-indexed by TriggerMatcher.event: O(#candidate triggers), not O(#permanents × #triggers). */
  triggersFor(eventType: EventBody['t']): readonly { readonly script: CardScript; readonly def: TriggerDef }[];
  staticsFor(layer: StaticDef['layer']): readonly { readonly script: CardScript; readonly def: StaticDef }[];
  replacements(): readonly { readonly script: CardScript; readonly def: ReplacementDef }[];
  readonly size: number;
}
export function createRegistry(scripts: readonly CardScript[]): ScriptRegistry;
export const EMPTY_REGISTRY: ScriptRegistry;   // ships in v1
```

**A script-less card is literally zero registrations.** `registry.get(oracleId)` returns `undefined`; `derive()` runs L1/L7b/L7d only; the trigger bus iterates an empty candidate list; `legalActions` offers only the intrinsic actions (play a land, cast if timing+cost allow, tap for mana from `OracleCard.producesMana`). Nothing in the engine branches on "is this card scripted" — the absence of registrations *is* the answer. That is the property that makes adding a script later a pure addition.

The script contract that keeps determinism:

```ts
// engine/scripts/api.ts
export interface ScriptCtx {
  readonly state: GameState;                 // read-only
  readonly oracle: OracleDb;
  readonly derive: DeriveFn;
  readonly options: GameOptions;
  /** Deterministic: seeded from state counters + a per-invocation call index, never from a global. */
  readonly ids: { nextInstance(): InstanceId; nextStack(): StackId };
  readonly query: EngineQueries;
  /** Scripts that need randomness declare it; the loop resolves it and threads rngAfter into the event. */
  readonly random: { below(n: number): number; shuffled<T>(xs: readonly T[]): readonly T[] };
}
```

Scripts **return events**; they never receive a mutation API. `ctx.random` is backed by a scratch `RngState` that `loop.ts` seeded from `state.rng` before the call; the loop attaches the resulting `rngAfter` to the emitted event. So a script is a pure function of `(state, self, obj)` and its output is fully reproducible from the log.

### 3.6 The trigger bus — events are the only source of truth

```ts
// engine/triggers.ts
export function collectTriggers(
  before: GameState, after: GameState,
  applied: readonly { readonly seq: EventSeq; readonly e: EventBody }[],
  oracle: OracleDb, scripts: ScriptRegistry,
): readonly PendingTrigger[];

export interface PendingTrigger {
  readonly source: InstanceId;
  readonly controller: PlayerId;
  readonly abilityRef: AbilityRef;
  readonly triggerEventSeq: EventSeq;
  readonly optional: boolean;
  readonly snapshot: TriggerSnapshot;   // LKI + intervening-if data captured at trigger time
}
export interface TriggerSnapshot {
  readonly dying?: readonly CardInstance[];    // LKI for "dies" triggers
  readonly numbers: Readonly<Record<string, number>>;
  readonly ids: Readonly<Record<string, InstanceId | PlayerId>>;
}

export function applyReplacements(
  state: GameState, oracle: OracleDb, scripts: ScriptRegistry, ev: EventBody,
): readonly EventBody[];
```

Because **every** state change in the engine goes through an event — including all Tier-3 manual tools — nothing can change the board without the bus seeing it. There is no "and also remember to fire triggers here" call site to forget. `applyReplacements` is invoked by a single funnel in `pump()` before any event is appended, so a replacement effect ("if a creature would die, exile it instead") sees every candidate exactly once.

---

## 4. The priority / state-based-action loop

### 4.1 `pump()` — the outer driver

```
pump(state):
  events = []
  loop up to MAX_ITER (10_000; exceeding it is a bug → throw with the last 20 events):
    batch = advance(state)
    if batch is empty: break
    for ev in batch:
      expanded = applyReplacements(state, ev)      // may be [] (prevented) or several
      for e2 in expanded:
        state = apply(state, e2); events.push(e2)
        assertInvariants(state)                    // dev + tests only
    pending = collectTriggers(before, state, batch)
    if pending: state = apply(state, {t:'…pendingTriggersAdded'})  // folded into advance's next pass
  return { state, events }
```

`advance()` returns `[]` in exactly two situations: the game is finished, or `state.priority.awaiting !== null` (blocked on a human). Those are the **only** two places the engine stops.

### 4.2 `advance()` — one unit of engine work, in strict order

```
advance(state):
 0. if state.phase === 'finished' → []
 1. SBA PASS (rule 704.3): actions = checkStateBasedActions(state, derive)
    if actions.length > 0 → return [StateBasedActionsApplied, ...consequential events]
    (called again next iteration; SBAs repeat until a pass yields nothing — 704.4)
 2. TRIGGER DRAIN (603.3b): if state.pendingTriggers.length > 0
      group by controller; order APNAP starting from the active player
      if a controller has ≥2 and hasn't ordered them → AwaitingSet{orderTriggers} → return
      else → return [AbilityTriggered × n]   (goes on the stack; loop repeats from step 1)
 3. if state.priority.awaiting !== null → []                   // BLOCKED ON INPUT
 4. TURN-BASED ACTIONS for the current step, if !turn.turnBasedActionsDone → return them
 5. PRIORITY:
    a. if this step grants no priority (untap, cleanup-with-nothing-to-do) → advance the step
    b. if all non-lost players are in passedSinceLastAction:
         if stack.length > 0 → resolve the top object; reset passedSinceLastAction
         else → StepEnded (+ ManaPoolEmptied ×n) → next step/phase/turn
    c. else → PrioritySet(next player in APNAP order who hasn't passed)
              then if shouldAutoPass(state, that player) → PriorityPassed{auto:true}
 6. return the events
```

Two details that matter and are easy to get wrong:

- **Step 1 before step 2 before step 3.** Rule 117.5: SBAs and triggers are handled *whenever a player would receive priority*, repeatedly, until none apply — and *before* the player actually gets it. Making these the first two branches of `advance()` and having `pump()` loop means the closure is structural rather than a hand-rolled `while` in one call site.
- **Mana pools empty at the end of each step *and* each phase** (rule 500.4). Emitting `ManaPoolEmptied` from the single `StepEnded` branch in 5b, and again on phase transition for the phases that have no steps (the main phases), covers both. The event carries `lost: ManaPool` so the UI can show "you lost {R}{R}" — a genuinely useful anti-frustration touch.

### 4.3 Turn-based actions per step

| Step | Turn-based action | Priority? |
|---|---|---|
| `untap` | AP untaps all their permanents (one `PermanentUntapped` batch); "phase in/out"; no player gets priority (502.3) | **No** |
| `upkeep` | none | Yes |
| `draw` | AP draws one card (`CardsMoved` library→hand). **Skipped on turn 1 by the starting player only in a two-player game** (103.7b); with 3–4 players nobody skips (103.7a) — see Q9 | Yes |
| `main` | none; `landsPlayedThisTurn` reset happens at `TurnBegan` | Yes |
| `beginCombat` | create `CombatState` | Yes |
| `declareAttackers` | `AwaitingSet{declareAttackers, AP}` → on submit: `AttackersDeclared` + `PermanentTapped` for non-vigilance attackers (508.1f) | Yes, after |
| `declareBlockers` | `AwaitingSet{declareBlockers, defending players}` → `BlockersDeclared` + `AttackerBecameBlocked` + order prompts + `FirstStrikeSubstepDecided` | Yes, after |
| `firstStrikeDamage` | compute + `CombatDamageDealt{firstStrike}` | Yes |
| `combatDamage` | compute + `CombatDamageDealt{regular}` | Yes |
| `endCombat` | at end of step: `RemovedFromCombat` all, `CombatEnded`, `combat = null` | Yes |
| `end` | none ("at the beginning of the end step" triggers fire via the bus on `StepBegan`) | Yes |
| `cleanup` | `DamageCleared` all, `ManaPoolEmptied`, end "until end of turn" effects. **No priority** unless an SBA or trigger occurred — then repeat cleanup *with* priority (514.3a) via `turn.cleanupNeedsRepeat` | Conditional |

`firstStrikeDamage` is inserted into the step sequence only when `combat.hasFirstStrikeSubstep` is true — `turn.ts`'s `nextStep()` consults `state.combat`.

### 4.4 Auto-pass / stops policy

```ts
export interface StopPolicy {
  readonly mode: 'auto' | 'fullControl';
  readonly alwaysStop: Readonly<Partial<Record<Step, boolean>>>;
  readonly stopOnMyUpkeep: boolean;
  readonly stopWhenAnyoneCasts: boolean;         // stack grew since I last held priority
  readonly stopBeforeCombatDamage: boolean;      // only if I'm attacking or blocking
  readonly stopWhenIHaveInstantSpeedPlay: boolean;  // the Arena default: stop iff I *can* do something
  readonly fullControlThisTurn: boolean;         // one-turn override, cleared at TurnBegan
}
export const DEFAULT_STOPS: StopPolicy = {
  mode: 'auto',
  alwaysStop: { declareAttackers: true, declareBlockers: true },
  stopOnMyUpkeep: false,
  stopWhenAnyoneCasts: true,
  stopBeforeCombatDamage: true,
  stopWhenIHaveInstantSpeedPlay: true,
  fullControlThisTurn: false,
};
```

```ts
export function shouldAutoPass(state: GameState, oracle: OracleDb, scripts: ScriptRegistry, p: PlayerId): boolean;
```

Returns `true` only if **all** of these hold:

1. `stops.mode === 'auto'` and `!stops.fullControlThisTurn`
2. `stops.alwaysStop[state.turn.step] !== true`
3. not (`stops.stopOnMyUpkeep` and step is `upkeep` and `p === activePlayer`)
4. not (`stops.stopWhenAnyoneCasts` and `state.stack.length > state.priority.stackSizeAtLastGrant`)
5. not (`stops.stopBeforeCombatDamage` and step is `declareBlockers` and `p` has a creature in `combat`)
6. `meaningfulActions(state, oracle, scripts, p).length === 0`

`meaningfulActions` = `legalActions` filtered to `PlayLand`, affordable `CastSpell`, and affordable `ActivateAbility`. **`TapForMana` is deliberately excluded** — otherwise a player with one untapped land would never auto-pass, which would destroy the whole feature.

Two extra rules that make this feel like Arena rather than merely correct:

- If `p` is the active player, never auto-pass out of a main phase while they still have a land drop available (`landsPlayedThisTurn < maxLandsPerTurn` and a land is in hand). Playing a land is the one action people forget.
- `HoldPriority` is a one-shot: after `p` puts an object on the stack with `holdingPriority === p`, `advance()` grants priority back to `p` and skips the auto-pass check exactly once, then clears the flag.

`legalActions` is the single shared primitive here — the same function drives UI card highlighting, the "you have no plays" auto-pass, and the "are you sure? you still have mana up" confirmation. Getting one function right instead of three is why it lives in its own module.

### 4.5 State-based actions (rule 704), one simultaneous pass

```ts
export type SbaAction =
  | { readonly t: 'playerLoses';          readonly player: PlayerId; readonly reason: LossReason }
  | { readonly t: 'zeroToughness';        readonly card: InstanceId }
  | { readonly t: 'lethalDamage';         readonly card: InstanceId }
  | { readonly t: 'zeroLoyalty';          readonly card: InstanceId }
  | { readonly t: 'zeroDefense';          readonly card: InstanceId }
  | { readonly t: 'auraFalls';            readonly card: InstanceId }
  | { readonly t: 'equipmentUnattaches';  readonly card: InstanceId }
  | { readonly t: 'legendRule';           readonly player: PlayerId; readonly name: string; readonly candidates: readonly InstanceId[] }
  | { readonly t: 'tokenCeasesToExist';   readonly card: InstanceId }
  | { readonly t: 'counterAnnihilation';  readonly card: InstanceId; readonly amount: number };

export function checkStateBasedActions(
  state: GameState, oracle: OracleDb, scripts: ScriptRegistry,
): { readonly actions: readonly SbaAction[]; readonly events: readonly EventBody[] };
```

One `makeDeriveCache` for the whole battlefield, then check in this order (all findings are gathered first, then applied simultaneously):

1. **Players lose** — `life <= 0`; `drewFromEmptyLibrary`; any `commanderDamage[x] >= 21`; `poison >= 10`.
2. **Toughness ≤ 0** → graveyard. Not a destruction; indestructible does not save it; not regenerable.
3. **Lethal damage** → destroy, unless `indestructible`. `derived.lethalDamage` is `damage >= toughness || (deathtouchDamage && damage >= 1)`.
4. **Planeswalker at 0 loyalty**, **battle at 0 defense** → graveyard.
5. **Illegal attachments** — an Aura attached to nothing or to an illegal object → graveyard (704.5m/n); Equipment/Fortification → merely unattaches.
6. **Legend rule** — group the controller's battlefield permanents by `derived.typeLine` containing `Legendary` and by name; if a group has ≥ 2, emit `legendRule` → `AwaitingSet{chooseLegendKeep}`. **Always ask, never auto-resolve**, even for two identical copies, because damage/counters/attachments differ and the choice is real.
7. **Tokens not on the battlefield** → cease to exist. Note the two-step: a dying token goes to the graveyard via `CardsMoved` (so "dies" triggers see it), then this SBA removes it on the next pass. That ordering is why `pump()` must loop rather than run one SBA pass.
8. **`+1/+1` and `-1/-1` on the same permanent** annihilate in pairs.

Then, Commander-specific: rule 903.9a is a **replacement effect the controller may apply**, not an SBA — when a commander would go to a graveyard or exile from anywhere, its owner may put it into the command zone instead. Implemented in `applyReplacements` as a built-in (not a card script), gated on `options.commanderZoneReplacement`: `'always'` rewrites the destination silently, `'ask'` emits `AwaitingSet{commanderZoneChoice}`, `'never'` leaves it. See Q3.

If any player lost, re-check: a 4-player game can have simultaneous losses, and the last player standing wins (`GameEnded`). If all remaining players lose simultaneously, the game is a draw — `GameEnded{winners: []}`.

---

## 5. Mana and casting

### 5.1 Cost → payment problem

```ts
export interface HybridRequirement {
  readonly index: number;
  readonly options: readonly ManaSymbol[];   // e.g. [{colored,W},{colored,U}] or [{generic,2},{colored,W}]
}
export interface PaymentProblem {
  readonly colored: Readonly<Record<Color, number>>;   // fixed colored symbols
  readonly colorless: number;                          // {C}
  readonly generic: number;                            // {2} + X·count
  readonly snow: number;
  readonly hybrids: readonly HybridRequirement[];
  readonly phyrexian: readonly Color[];                 // each: pay the color or 2 life
  readonly additionalLife: number;                      // life costs from additional costs
  readonly totalMana: number;                           // lower bound on mana needed
}
export function buildPaymentProblem(
  base: ManaCost | null, xValue: number, additional: readonly ManaCost[], commanderTax: number,
): PaymentProblem;
export function poolCovers(pool: ManaPool, prob: PaymentProblem): boolean;
```

`commanderTax` is `{2} × card.commanderCastCount` folded into `generic` — see 5.4.

### 5.2 The auto-tap solver

Problem statement: given untapped sources `S` (each with output options `O_s` and an amount), the current pool `P`, and a `PaymentProblem` `R`, choose a minimal, *sensible* subset of `S` with an output choice per source such that `R` is satisfiable.

**Three-tier approach**, escalating only when needed:

**Tier A — necessary-condition filter, O(|S| · 6).** Total available mana (`pool` + Σ source amounts) ≥ `R.totalMana`, and for each color `c`, `pool[c] + Σ{amount : c ∈ O_s} ≥ R.colored[c]`. Cheap reject. This is what `legalActions` uses for its `affordable` flag on every card, every priority grant — memoized on `state.eventCount` so a whole priority round costs one computation.

**Tier B — greedy, O(|S| log |S|).** Satisfies ~95% of real boards:
1. Sort colored requirements by *scarcity* (fewest capable sources first).
2. For each, consume sources in ascending `flexibilityRank` (plain basics before any-color lands before mana creatures) — i.e. spend the *least* flexible source that can pay.
3. Resolve hybrids after fixed colored, choosing the option whose color has the most slack.
4. Pay generic with the remaining least-flexible sources.
5. Verify with `poolCovers`. If it holds, done.

**Tier C — min-cost max-flow, only when greedy fails.** Graph:

```
super-source ──cap=amount_s, cost=0──> [source s]
[source s]   ──cap=∞, cost=w(s,c)───> [color node c]        for each c ∈ O_s
[color c]    ──cap=R.colored[c], cost=0──> [req_c] ──> sink
[color c]    ──cap=∞, cost=0──────────> [generic] ──cap=R.generic──> sink
[color C]    ──cap=R.colorless──────> [req_C] ──> sink       (colorless only from {C} sources)
[color c]    ──cap=1, cost=0─────────> [hybrid_i]  for each acceptable c ──> sink
```

Feasible iff max flow == `R.colored total + colorless + generic + snow + #hybrids`. Costs `w(s,c) = |O_s| + flexibilityRank(s) + (isCreature(s) ? 4 : 0)` — this is what makes the suggestion *good* rather than merely legal: it hoards flexible sources and avoids tapping creatures.

**Complexity bound.** `|S| ≤ ~40` untapped sources even on a huge Commander board; 6 color nodes; ≤ ~12 requirement nodes. So `V ≤ 64`, `E ≤ 40·6 + 6·12 + 20 ≈ 340`, and total flow `F ≤ ~64`. SPFA-based MCMF is `O(F · V · E)` ≈ 64 · 64 · 340 ≈ **1.4 M elementary ops worst case, well under 1 ms in JS**; typical cases are two orders of magnitude smaller and never reach Tier C at all.

**Hybrid/phyrexian.** Exact feasibility with hybrids is combinatorial in general. With `k ≤ 5` hybrid symbols, enumerate the expansions (2^k for `{W/U}`, 2^k for `{2/W}`, 2^k for phyrexian pay-or-life) capped at 64 combinations, run Tier B on each and Tier C on the survivors. If a card exceeds the cap (essentially nonexistent), return "manual payment required" and let the player tap lands by hand — an honest, non-lying fallback.

```ts
export interface PaymentPlan {
  readonly taps: readonly { readonly source: InstanceId; readonly abilityIndex: number; readonly outputChoice: number }[];
  readonly spendFromPool: ManaPool;
  readonly hybridChoices: readonly { readonly index: number; readonly option: number }[];
  readonly phyrexianLife: readonly Color[];      // symbols paid with 2 life each
  readonly forEventCount: number;               // staleness guard
}
export function suggestPayment(view: PlayerView, oracle: OracleDb, prob: PaymentProblem): PaymentPlan | null;
export function validatePlan(state: GameState, oracle: OracleDb, p: PlayerId, prob: PaymentProblem, plan: PaymentPlan): boolean;
```

`suggestPayment` takes a `PlayerView`, not a `GameState` — it runs **client-side**, because everything it needs (your battlefield, your pool) is public. The host re-validates with `validatePlan` against real state; `plan.forEventCount !== state.eventCount` plus a changed board yields `'stalePaymentPlan'` and the client silently re-suggests.

Sources with `ManaProduction.conditional === true` (text containing "if"/"unless"/"only"/"Spend this mana only") are **excluded from auto-tap** but remain manually tappable. This is the Tier-2/Tier-3 boundary made explicit rather than the engine guessing and being wrong.

### 5.3 Casting as a resumable state machine

```ts
export interface PendingCast {
  readonly player: PlayerId;
  readonly card: InstanceId;
  readonly from: ZoneRef;
  readonly stackId: StackId;
  readonly stage: 'modes' | 'targets' | 'x' | 'pay' | 'ready';
  readonly kind: 'spell' | 'ability';
  readonly abilityRef: AbilityRef | null;
  readonly modes: readonly number[];
  readonly targets: readonly TargetChoice[];
  readonly xValue: number | null;
  readonly problem: PaymentProblem;
  readonly paidSoFar: ManaPool;
  readonly isCommanderCast: boolean;
  readonly taxApplied: number;
}
```

Rule 601 order, each stage a separate event so it is reconnect-safe:

```
601.2a  CardsMoved(card → stack)  +  CastBegan{pending}
601.2b  choose modes / targets / X   → AwaitingSet{chooseTargets} → TargetsChosen
601.2f  determine total cost: base + commander tax + additional costs
601.2g  activate mana abilities      → PermanentTapped + ManaAdded (the plan's taps)
601.2h  pay                         → ManaSpent (+ LifeChanged for phyrexian)
        → SpellCast{obj}            (the spell is now on the stack; it was never "half-cast")
```

**`PendingCast` lives in `GameState`, not in UI state.** This is the point: a player who drops mid-cast reconnects and finds the same half-finished cast waiting, because the host's authoritative state holds it. Putting it in the React store would make "Bob disconnected while choosing targets" unrecoverable.

`CancelPendingCast` emits compensating events (`CardsMoved` back to `from`, `ManaAdded` restoring the pool, `PermanentUntapped` for the taps) with `cause.kind = 'rewindCompensation'`, plus `CastCancelled`. The log stays append-only. Alternative (log truncation for cancels) is simpler to read but breaks the "append-only" invariant that everything else depends on — not worth it.

### 5.4 Commander tax

- `handle('CastSpell')` computes `tax = 2 * card.commanderCastCount` when `from.kind === 'command'` and `card.isCommander`, folds it into `PaymentProblem.generic`, and records `taxApplied` on the `PendingCast` and `SpellObject`.
- The counter increments **after** the cast is complete: `CommanderCastCountIncreased{card, to}` is emitted alongside `SpellCast`. So the first cast is +0, second +2, third +4 (903.8).
- The counter lives on the `CardInstance` and survives zone changes, so it is correct across the command-zone bounce loop that defines Commander.
- Casting a commander from anywhere *other* than the command zone (from hand after it was returned, from the graveyard via a script) applies **no** tax and does **not** increment the counter — that's the rule, and it's a common source of confusion, so the UI should show "Commander tax: {4} (3rd cast from command zone)" explicitly.

---

## 6. Combat, step by step

### 6.1 `beginCombat`

`CombatBegan` creates an empty `CombatState`. Triggers matching `StepBegan{step:'beginCombat'}` fire through the bus. Priority (AP first). Nothing else.

### 6.2 `declareAttackers` (rule 508)

**Legality** — `canAttack(state, derive, id)`:
- is a creature, controlled by the active player, on the battlefield, not `phasedOut`
- untapped
- no summoning sickness: `summonedOnTurn !== turn.turnNumber` **or** has `haste`
- does not have `defender`
- passes every script `canAttack` restriction (v1: none)

**Legal defenders**: each opponent with `!hasLost`, plus planeswalkers and battles they control.

On submit: validate all declarations, then `AttackersDeclared`, then `PermanentTapped` for each attacker lacking `vigilance` (508.1f), then trigger collection ("whenever ~ attacks"), then priority.

### 6.3 `declareBlockers` (rule 509)

Blockers are declared **simultaneously** by all defending players. `AwaitingInput{kind:'declareBlockers', players, submitted}` accepts submissions in any order and only proceeds when every defending player with at least one potential blocker has submitted (a player with no possible blockers is auto-submitted with an empty declaration).

**Per-pair legality** — `canBlock(derive, blocker, attacker)`:

| Keyword on attacker | Requirement on blocker |
|---|---|
| `flying` | must have `flying` or `reach` |
| `protection` from colour C | blocker must not be colour C (702.16e: can't be blocked by) |
| `fear` | blocker must be artifact or black |
| `intimidate` | blocker must be artifact or share a colour |
| `shadow` | blocker must have `shadow`; a shadow-less attacker can't be blocked by a shadow creature |
| `skulk` | blocker's power ≤ attacker's power |
| `horsemanship` | blocker must have `horsemanship` |
| `landwalk` (types L) | if the *defending player* controls a land with a type in L, the creature can't be blocked at all |

Blocker must also be untapped, controlled by a defending player, not `phasedOut`, and `derived.isCreature`.

**Aggregate legality** — validated over the whole declaration, not per pair:
- `menace`: an attacker with menace is blocked by 0 or ≥ 2 creatures. One blocker → reject with `'menaceRequiresTwo'`. **This is why blocker declaration must be a single atomic intent per player, not one intent per block** — a per-pair API cannot express "two at once."
- "must be blocked" requirements and max-blockers restrictions (v1: none; the validation seam exists).

On accept: `BlockersDeclared`, then `AttackerBecameBlocked` for each attacker with ≥ 1 blocker (this sets the **sticky** `becameBlocked` flag), then:

**Damage assignment order (509.2):**
- For each attacker with ≥ 2 blockers → `AwaitingSet{orderBlockers, AP, attacker}` → `BlockerOrderSet`.
- For each blocker blocking ≥ 2 attackers → `AwaitingSet{orderAttackers, that blocker's controller}` → `AttackerOrderSet`.
- Single-blocker cases are auto-ordered with no prompt.

Then `FirstStrikeSubstepDecided{needed}` where `needed = any creature in combat has firstStrike || doubleStrike`. Then priority.

### 6.4 Damage sub-steps (rule 510, 702.4, 702.7)

```ts
export interface DamageAssignment { readonly to: DamageTarget; readonly amount: number }
export type DamageTarget =
  | { readonly kind: 'card';   readonly id: InstanceId }
  | { readonly kind: 'player'; readonly id: PlayerId };

export interface ResolvedDamage {
  readonly source: InstanceId;
  readonly target: DamageTarget;
  readonly amount: number;
  readonly deathtouch: boolean;
  readonly lifelinkTo: PlayerId | null;
  readonly isCommanderDamage: boolean;   // source.isCommander && target.kind === 'player'
  readonly viaTrample: number;           // portion assigned by trample, for the log
}
```

Which creatures deal damage in which sub-step:

| Sub-step | Deals damage |
|---|---|
| `firstStrikeDamage` | creatures with `firstStrike` or `doubleStrike` |
| `combatDamage` | creatures with neither, **plus** creatures with `doubleStrike` that already dealt first-strike damage |

Per-attacker assignment (`assignAttackerDamage`):

```
p = derive(A).power ; if p <= 0 → no assignment
if A.blockerOrder is empty:
    if A.becameBlocked → assign NOTHING          // 509.1h — sticky flag earns its keep
    else → assign p to A.defender
else:
    remaining = p ; assigned = {}
    for b in A.blockerOrder, skipping removed/no-longer-a-creature:
        lethal = deathtouch(A) ? 1 : max(0, toughness(b) - damage(b) - assigned[b])
        give = min(remaining, lethal) ; assigned[b] += give ; remaining -= give
        if remaining === 0 → break
    if remaining > 0:
        if trample(A) and every blocker in the order got lethal:
            assign remaining to A.defender, viaTrample = remaining
        else:
            assigned[last blocker considered] += remaining     // all damage must be assigned
```

Blockers assign back symmetrically over `attackerOrder` with the same lethal logic (a blocker blocking two attackers divides its power).

**Simultaneity is structural.** The entire assignment map for the sub-step is computed first, then emitted as **one** `CombatDamageDealt` event, and `apply()` folds all of it atomically: `damage` marks, `deathtouchDamage` flags, `LifeChanged` for player damage, lifelink life gain, and commander-damage tallies. Consequences that fall out for free rather than needing special cases:

- **deathtouch + lifelink**: a 1/1 deathtouch lifelinker trading with a 5/5 gains its controller 1 life even though it dies in the same SBA pass — because life gain is part of the same atomic event, and the SBA check happens afterward.
- **first strike**: the first-strike creature's damage is applied and SBAs run (killing the blocker) *before* `combatDamage`, so a dead blocker deals nothing back. This works because `pump()` runs a full SBA closure between the two damage steps.
- **trample + deathtouch**: only 1 damage per blocker is "lethal", so the rest tramples over. The `lethal = deathtouch ? 1 : …` line is the whole implementation.
- **indestructible**: irrelevant here; it's an SBA-step concern.

**Commander damage attribution.** `isCommanderDamage` is set only when the source has `isCommander === true` **and** the target is a player **and** the event is `CombatDamageDealt` (903.10a: combat damage only). `apply()` does `players[target].commanderDamage[source.id] += amount` and emits `CommanderDamageDealt{total}`. Because the key is the commander's **instance id**, damage from two different commanders never pools, a partner pair tracks separately, and a Tier-3 "this creature becomes your commander" starts a fresh tally — all without extra code. The SBA check is `Object.values(commanderDamage).some(v => v >= options.commanderDamageThreshold)`.

**Manual override.** `options.manualCombatDamageAssignment` (or a per-player stop) turns the auto-assignment into a proposal: `AwaitingSet{assignCombatDamage}` per attacker with a real choice, pre-filled with the automatic answer. See Q5.

### 6.5 `endCombat` (rule 511)

`StepBegan{endCombat}` fires "at end of combat" triggers; at `StepEnded`, `RemovedFromCombat` for every creature in combat, `CombatEnded`, and `combat = null`. Note that damage marked on creatures persists until `cleanup` — it is *not* cleared at end of combat, a detail people frequently get wrong.

### 6.6 Known simplification to flag

Rule 510.5 (a creature that had first strike as the first damage step began and loses it still doesn't deal damage in the second step) is handled approximately: `dealtFirstStrikeDamage` on the decl prevents double-dipping, and keyword lookup happens at the start of each sub-step. The exotic case "gains first strike after the first-strike step" is not special-cased. This is Tier-2-appropriate and worth one line in `DECISIONS.md` rather than machinery.

---

## 7. Networking and view-model filtering

### 7.1 Wire protocol

```ts
// src/net/protocol.ts
export const PROTOCOL_VERSION = 1;
export type ConnId = Brand<string, 'ConnId'>;

/** The ONLY fields the relay reads: v, room, to. Everything else is opaque bytes to it. */
export interface Envelope {
  readonly v: number;
  readonly room: string;
  readonly from: ConnId;
  readonly to: ConnId | 'host' | 'all';
  readonly seq: number;                  // per-sender monotone
  readonly ack: number;                  // highest seq seen from the peer
  readonly body: ClientToHost | HostToClient | RelayControl;
}

export type ClientToHost =
  | { readonly t: 'Hello'; readonly protocol: number; readonly appVersion: string;
      readonly playerName: string; readonly resumeToken?: string }
  | { readonly t: 'SubmitDeck'; readonly deck: DeckSubmission }
  | { readonly t: 'SetReady'; readonly ready: boolean }
  | { readonly t: 'Intent'; readonly intentId: string; readonly intent: Intent }
  | { readonly t: 'RequestResync'; readonly haveEventCount: number; readonly viewHash: string }
  | { readonly t: 'Ping'; readonly nonce: number }
  | { readonly t: 'ChatSend'; readonly text: string };

export type HostToClient =
  | { readonly t: 'Welcome'; readonly you: PlayerId; readonly resumeToken: string;
      readonly lobby: LobbyView; readonly protocol: number; readonly oracleVersion: string }
  | { readonly t: 'LobbyUpdate'; readonly lobby: LobbyView }
  | { readonly t: 'Snapshot'; readonly eventCount: number; readonly view: PlayerView; readonly viewHash: string }
  | { readonly t: 'Update'; readonly base: number; readonly next: number; readonly patch: ViewPatch;
      readonly narration: readonly RedactedEvent[]; readonly viewHash: string }
  | { readonly t: 'IntentRejected'; readonly intentId: string; readonly reason: RejectReason; readonly message: string }
  | { readonly t: 'Presence'; readonly players: readonly { readonly id: PlayerId; readonly connected: boolean; readonly rttMs: number | null }[] }
  | { readonly t: 'ChatPosted'; readonly player: PlayerId; readonly text: string; readonly tHostMs: number }
  | { readonly t: 'Pong'; readonly nonce: number }
  | { readonly t: 'Error'; readonly code: 'protocolMismatch' | 'roomFull' | 'notSeated' | 'oracleMismatch' | 'gameOver';
      readonly message: string };

export type RelayControl =
  | { readonly t: 'RelayCreateRoom' }
  | { readonly t: 'RelayRoomCreated'; readonly code: string; readonly connId: ConnId }
  | { readonly t: 'RelayJoin'; readonly code: string }
  | { readonly t: 'RelayJoined'; readonly code: string; readonly connId: ConnId; readonly hostPresent: boolean }
  | { readonly t: 'RelayPeerJoined'; readonly connId: ConnId }
  | { readonly t: 'RelayPeerLeft'; readonly connId: ConnId }
  | { readonly t: 'RelayError'; readonly code: 'noSuchRoom' | 'roomFull' | 'rateLimited' | 'protocolMismatch'; readonly message: string };

export interface DeckSubmission {
  readonly name: string;
  readonly commanders: readonly { readonly oracleId: OracleId; readonly printingId: PrintingId }[];
  readonly mainDeck: readonly { readonly oracleId: OracleId; readonly printingId: PrintingId }[];
}
export interface LobbyView {
  readonly code: string;
  readonly hostName: string;
  readonly options: GameOptions;
  readonly seats: readonly { readonly id: PlayerId; readonly name: string; readonly seat: number;
                             readonly deckName: string | null; readonly ready: boolean; readonly connected: boolean }[];
}
```

### 7.2 Lobby / join / room-code flow

```
HOST                          RELAY                          CLIENT
 │ RelayCreateRoom ──────────► │
 │ ◄──── RelayRoomCreated{code:'K7M2QX'}
 │  (UI shows the code)        │
 │                             │ ◄────── RelayJoin{code}  ────┤
 │ ◄─ RelayPeerJoined{connId}  │ ──── RelayJoined ───────────► │
 │ ◄──────────────── Hello{protocol, appVersion, playerName} ──┤   (to:'host')
 │ ── Welcome{you:'p1', resumeToken, lobby, oracleVersion} ───► │
 │ ◄──────────────── SubmitDeck{deck} ────────────────────────┤
 │ ── LobbyUpdate ─────────────────────────────────────► all   │
 │ ◄──────────────── SetReady{true} ──────────────────────────┤
 │  (host clicks Start; generates seed via crypto.getRandomValues)
 │  handle(StartGame) → pump() → per-player project()
 │ ── Snapshot{eventCount, view, viewHash} ───────────────────► │  (one per player, each different)
 │ ◄──────────────── Intent{intentId, intent} ────────────────┤
 │  handle → apply → pump → project → diff → redact
 │ ── Update{base, next, patch, narration, viewHash} ─────────► │
```

Room codes: 6 chars from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no I/O/0/1) — 32⁶ ≈ 1.07 × 10⁹, ambiguity-free when read aloud over voice chat, which is the actual use case. TTL 4 h, evicted 5 min after the host disconnects.

`oracleVersion` is compared at `Welcome`; a mismatch is a hard `Error{oracleMismatch}` rather than a subtle divergence, because two players on different Scryfall snapshots can disagree about oracle text.

Sequence numbers: per-sender monotone on the `Envelope`, with `ack` piggybacked. WebSocket already guarantees ordered delivery over one connection, so `seq` exists for exactly two jobs: (1) detecting a gap after a reconnect on a *new* socket, and (2) idempotent intent handling — the host remembers the last `intentId` per player and ignores a duplicate, so a client that retries after a flaky send can't double-cast.

### 7.3 `project(state, playerId) => PlayerView`

```ts
export function project(state: GameState, oracle: OracleDb, scripts: ScriptRegistry, viewer: PlayerId): PlayerView;

export const FACE_DOWN_ORACLE_ID = '__facedown__' as OracleId;

export interface HiddenCard {
  readonly id: InstanceId; readonly hidden: true; readonly zone: ZoneRef;
}
export type FaceDownCard = Omit<CardInstance, 'oracleId' | 'printingId'> & {
  readonly oracleId: typeof FACE_DOWN_ORACLE_ID; readonly printingId: null; readonly faceDown: true;
};
export type ViewCard = (CardInstance & { readonly hidden?: false }) | HiddenCard | FaceDownCard;

export interface ViewZones {
  readonly battlefield: readonly InstanceId[];
  readonly hand:      Readonly<Record<PlayerId, readonly InstanceId[]>>;  // opponents: opaque ids, correct length
  readonly library:   Readonly<Record<PlayerId, number>>;                 // COUNT ONLY — never ids, never order
  readonly graveyard: Readonly<Record<PlayerId, readonly InstanceId[]>>;
  readonly exile:     Readonly<Record<PlayerId, readonly InstanceId[]>>;
  readonly command:   Readonly<Record<PlayerId, readonly InstanceId[]>>;
}
export interface PlayerPublic {
  readonly id: PlayerId; readonly name: string; readonly seat: number;
  readonly life: number; readonly pool: ManaPool; readonly poison: number;
  readonly commanderDamage: Readonly<Record<InstanceId, number>>;
  readonly handCount: number; readonly libraryCount: number;
  readonly graveyardCount: number; readonly exileCount: number;
  readonly landsPlayedThisTurn: number; readonly maxLandsPerTurn: number;
  readonly hasLost: boolean; readonly lossReason: LossReason | null;
  readonly mulligan: MulliganState;
  readonly connected: boolean;              // merged in from HostSession.presence
  readonly rttMs: number | null;
  readonly stops: StopPolicy | null;        // non-null ONLY for the viewer
}
export interface PlayerView {
  readonly you: PlayerId;
  readonly eventCount: number;
  readonly gamePhase: GamePhase;
  readonly options: GameOptions;
  readonly seating: readonly PlayerId[];
  readonly turn: TurnState;
  readonly priority: PriorityState;         // `awaiting` narrowed — see rule 9
  readonly combat: CombatState | null;
  readonly stack: readonly StackObject[];
  readonly cards: Readonly<Record<InstanceId, ViewCard>>;
  readonly zones: ViewZones;
  readonly revealed: readonly InstanceId[]; // hidden-zone cards this viewer may see
  readonly pendingCast: PendingCast | null; // only if yours
  readonly legalActions: readonly LegalAction[];   // computed for YOU only
  readonly derived: Readonly<Record<InstanceId, DerivedCharacteristics>>; // battlefield only, precomputed
  readonly winners: readonly PlayerId[];
}
```

Redaction rules, exactly:

1. **Your hand** → full `CardInstance`.
2. **An opponent's hand** → `HiddenCard{id, hidden:true, zone}` per card, so the array length is the true hand size and the UI can animate *that specific* card back moving hand → battlefield. Ids are opaque sequence numbers; see Q10 for the residual ordering leak.
3. **Any library, including your own** → count only in `zones.library`. Never ids, never order. **The host's own player is redacted identically** — the host process holds the shuffled order but `project()` strips it, and the game UI reads *only* the view. This is the invariant that makes accidental cheating structurally impossible rather than a matter of discipline (see 7.6).
4. **Cards revealed to you** (scry, surveil, "reveal the top card", Tier-3 peek) → the card appears in `cards` as a full `CardInstance` and its id is listed in `view.revealed`. Library *ordering* is still not exposed; the UI renders `revealed` as a separate "you know:" tray. `CardInstance.revealedTo` is the source of truth; `RevealCleared` removes it.
5. **Face-down battlefield / stack permanents** → `FaceDownCard`: `oracleId` replaced with `FACE_DOWN_ORACLE_ID`, `printingId: null`, but `tapped`, `damage`, `counters`, `attachments`, `controller`, `ptOverride` all visible (a face-down creature is a public 2/2 object whose *identity* is hidden). The controller is implicitly in `revealedTo`, so they see the real card.
6. **Face-down exile** → `HiddenCard` unless the viewer is in `revealedTo`.
7. **Graveyard, exile, command zone, battlefield, stack** → fully public (modulo rules 5 and 6).
8. **`legalActions`** → computed for the viewer only. Computing it for opponents would leak the contents and affordability of their hands.
9. **`priority.awaiting`** → if it names another player, reduce to `{kind, player}` with any payload stripped, so the UI can say "Bob is choosing blockers" without learning what Bob is choosing among. `pendingCast` → `null` unless it's yours.
10. **`derived`** → battlefield objects only; precomputed host-side so four clients don't each re-run the layer pipeline, and so a client-side derive bug cannot make two players see different P/T.
11. **Narration**: `LibraryShuffled.order` stripped for **everyone** including the owner. `DeckLoaded.cards` stripped to a count for everyone (the client already owns its own deck file; it does not need instance ids for a zone it can't see). `ManualPeekLibrary` results visible only to the peeker.

```ts
export function redactEvent(ev: EventBody, viewer: PlayerId, after: GameState): RedactedEvent | null;
```
Returns `null` for the rare event a viewer shouldn't know happened at all. Because narration is advisory (D-NET-1), a bug here degrades an animation; it cannot desync state.

### 7.4 `ViewPatch`

```ts
export interface ViewPatch {
  readonly base: number;                                    // must equal the client's eventCount
  readonly next: number;
  readonly set: Readonly<Record<string, unknown>>;           // 'cards.c41' | 'players.p2' | 'zones.hand.p0' | 'turn' | …
  readonly del: readonly string[];                           // keys removed (a card left this viewer's visibility)
}
export function diffView(prev: PlayerView, next: PlayerView): ViewPatch;
```

Diff granularity is deliberately coarse — one key per `cards.<id>`, per `players.<id>`, per `zones.<zone>.<player>`, and whole-value for `turn`, `priority`, `combat`, `stack`, `legalActions`, `revealed`, `derived`. A typical update touches 1–4 cards → about 1 KB. A wrath touches 30 → about 8 KB. No JSON-Patch library, no operational transforms, ~60 lines. If `patch.base !== client.eventCount`, the client sends `RequestResync` instead of guessing.

### 7.5 Reconnect: full snapshot, not log replay

```
client socket dies
  → host: presence[p] = false; Presence broadcast; the game PAUSES if awaiting names p
  → client: exponential backoff reconnect (0.5s → 8s cap), same room code
  → Hello{resumeToken}
  → host: verify resumeToken = HMAC(gameId + playerId, hostSecret); reseat the SAME PlayerId
  → Snapshot{eventCount, view: project(state, p), viewHash}
  → resume Update streaming
```

Full snapshot, categorically, because:
- The client never runs the reducer, so a log would be useless to it.
- The log contains hidden information, and redacting each historical event *as of its own historical state* is strictly harder than projecting once from the present.
- A snapshot is O(state) ≈ 150 KB and is correct by construction; there is no partial-catchup edge case to get wrong.
- Log replay *is* used — by the host, on app restart, to restore an interrupted game from `%APPDATA%/<app>/games/<gameId>.ndjson`, via the same `apply()`.

`resumeToken` being an HMAC (not a bare player id) means a reconnecting client cannot claim someone else's seat and thereby their hand. That is cheap and worth doing even under a friends-only trust model, because the real threat is an honest mistake — two people clicking rejoin at once.

**Desync detection.** Host computes `viewHash = xxhash64(canonicalJson(view))` after projection; client recomputes after applying each patch. On mismatch the client sends `RequestResync{haveEventCount, viewHash}`, the host replies with a `Snapshot`, and both sides write `{eventCount, hostHash, clientHash, patch}` to `desync.log`. The mismatch is repaired in one round-trip and *recorded*, which is what turns "the board looked wrong once" into a fixable bug report.

### 7.6 The anti-accidental-cheating invariant

The host process holds every player's hand and library in memory. The protection is architectural, not behavioural:

- Renderer game UI imports **only** `PlayerView` types from `src/engine/types/views.ts` and `src/net/client.ts`. It never imports `GameState`.
- The host's own local player runs through `loopbackTransport` — the same `ClientSession`, holding the same projected `PlayerView`. The host UI has no privileged path to state.
- Enforced by an ESLint `no-restricted-imports` boundary rule and by a test that greps every file under `src/ui/` for `engine/types/state` / `net/host` imports.

Bonus: because the host player is just another client over a loopback transport, a test can run four clients plus a host in one process and play a complete game — the highest-value integration test available (§8).

### 7.7 Why the relay needs zero game logic

The relay's entire job: **room registry + blind forwarding + presence.**

- The host is authoritative by decision. A relay that understood the game would be a second source of truth — the exact thing that causes "the server and the host disagree" bugs with no principled resolution.
- Redaction happens host-side, *before* transmission. Every frame is already addressed to one recipient and already stripped. The relay therefore never needs to know what a hand is in order to avoid leaking one.
- Statelessness-per-message makes the relay ~150 lines, deployable anywhere Node runs, restartable mid-game (clients reconnect and resync), and impossible to desync.
- Zero dependency on the card database, the oracle version, or the rules — so a rules change never requires redeploying the relay.

What it *does* do: protocol-version gate, room create/join/TTL, forward by `to` (`'host'` → the room's host conn; `'all'` → every member except the sender; a `ConnId` → that member), `RelayPeerJoined`/`RelayPeerLeft` presence, per-conn rate limit (e.g. 200 msg/s, 1 MB/msg), and a room member cap of 4.

**Confidentiality caveat to flag (Q11):** the relay operator can read all traffic in aggregate, since each client's redacted frames pass through it. Under friends-only trust with a self-hosted relay this is fine. If it matters, a near-free hardening is AES-GCM over `Envelope.body` with a key derived (PBKDF2/HKDF via WebCrypto) from the room code plus a short passphrase shown in the host's UI — no new dependency, and the relay keeps working because it only reads `v`/`room`/`to`.

---

## 8. Determinism and testing strategy

### 8.1 Introduce Vitest — argued for

**For:**
1. A rules engine is the single most test-shaped artifact in software: pure functions, no DOM, no I/O, hundreds of small independent scenarios, and a correctness bar where "looks right on screen" is worthless. `derive()`, `assignAttackerDamage()`, `checkStateBasedActions()`, `suggestPayment()` are all `(input) => output`.
2. **Zero shipping risk.** `vitest` is a devDependency; `electron-builder`'s `files` array (`dist/**`, `electron/**`, `package.json`) already excludes it from the NSIS output. The offline-first and packaging mandates are untouched.
3. **Near-zero config cost.** Vite is already the build tool in every app here. Vitest reuses `vite.config.ts` and the existing `tsconfig` — no Babel, no ts-jest, no separate transform pipeline. Adding it is `npm i -D vitest` plus a six-line `test` block.
4. **CDP probes cannot do this job.** A probe boots Electron (~3 s), drives the real UI, and returns a JSON blob. It's excellent for the shell — Electron boot, IPC, LAN server binding, offline audit, "does the battlefield render." It is hopeless for 200 rules scenarios: no per-case isolation, no useful failure messages, no watch mode, and a 10-minute feedback loop.
5. **Additive and reversible.** No existing app in the workspace is touched. One new `npm run test` script in one new project.

**Against, honestly:** it is a workspace first, and the workspace's simplicity rule ("nothing speculative") deserves respect. The counter is that tests here are not speculative — they are the only mechanism by which "21 commander damage is a loss" can be *known* rather than hoped. The alternative considered was Node's built-in `node:test`, which is genuinely zero-dependency but needs a TS loader (`tsx`) for `.ts` files, which is *more* setup than Vitest, with no watch mode and no coverage.

**Recommendation: adopt Vitest for `src/engine/` and `src/net/` (protocol + host/client over loopback). Keep CDP probes for the Electron shell.** Two tools, two clearly separated jobs. Document the split in the project's `AGENTS.md`.

Config: `environment: 'node'` (the engine must never need a DOM — that is itself a test), `include: ['src/**/*.test.ts']`, no globals (explicit `import { test, expect } from 'vitest'`).

### 8.2 What to test

**A. Determinism primitives**
- `rng.test.ts` — known-answer vectors for `seedRng`/`nextU32`; `nextBelow` unbiased over 10⁶ draws; `shuffle` is a permutation; same seed ⇒ same order; different seeds ⇒ different order.
- `hash.test.ts` — `canonicalJson` is key-order independent; `stateHash` stable across structurally-equal states built by different code paths.
- `purity.test.ts` — read every file under `src/engine/`, assert no import matches `react|electron|^node:|^fs|^path|zustand`, and no source text contains `Date.now()`, `Math.random()`, `performance.now()`, `crypto.` . A regex test, but it defends the single most important architectural property.

**B. Scenario table** — the workhorse:

```ts
export interface Scenario {
  readonly name: string;
  readonly setup: SetupSpec;              // players, decks by card NAME, starting zones, life, turn/step, options
  readonly intents: readonly Intent[];
  readonly expectEvents?: readonly Partial<EventBody>[];   // ordered subsequence match
  readonly expectRejected?: readonly RejectReason[];
  readonly assert?: (a: ScenarioAssertions) => void;
}
export interface ScenarioAssertions {
  readonly state: GameState;
  readonly log: readonly LogEntry[];
  readonly view: (p: PlayerId) => PlayerView;
  readonly derived: (id: InstanceId) => DerivedCharacteristics;
  card(nameOrRef: string): CardInstance;   // resolve by card name within a zone
}
```

`SetupSpec` builds a mid-game board directly (via a test-only builder that emits real events, so even fixtures go through `apply`). Concrete cases to write, grouped:

- **Setup** (6): 4 players seated in order; 100-card decks; commanders start in the command zone; 40 life; 7-card opening hands; libraries = 99; `zones.library` invisible in every view.
- **Mulligan** (5): keep 7 bottoms 0; one mulligan → draw 7, bottom 1; three mulligans → bottom 3; free-first-mulligan option on/off; all four players mulligan simultaneously.
- **Turn structure** (8): untap grants no priority; AP draws in the draw step; starting player skips draw at 2 players but not at 3–4; pools empty at end of each step; land drop resets at `TurnBegan`; turn passes seat 0→1→2→3→0; a lost player is skipped; cleanup clears damage.
- **Mana + casting** (10): pool arithmetic; `{3}{G}{G}` with 2 Forest + Command Tower + 2 Island → exact expected tap set (asserts the greedy preference for basics over Command Tower); `{X}` with X=4; hybrid `{W/U}` paid two ways; phyrexian paid with life; insufficient mana → `'cannotAfford'`; commander tax 0 → 2 → 4 across three casts from the command zone; a commander cast from *hand* pays no tax and doesn't increment; stale payment plan → `'stalePaymentPlan'`; a conditional mana source is excluded from auto-tap but manually tappable.
- **Stack + priority** (8): cast → respond → LIFO resolution; all-pass with an empty stack ends the step; a spell whose only target became illegal fizzles; a countered spell goes to its owner's graveyard; `HoldPriority` returns priority once; auto-pass fires when a player has no meaningful action; auto-pass does **not** fire when they hold an affordable instant; `stopWhenAnyoneCasts` interrupts the auto-pass chain.
- **Combat matrix** (16, one per interaction): flyer blocked by ground creature → `'illegalBlock'`; reach blocks a flyer; menace with 1 blocker → `'menaceRequiresTwo'`, with 2 → accepted; trample excess to the defending player; trample + deathtouch assigns 1 per blocker and tramples the rest; deathtouch 1/1 kills a 5/5; deathtouch + lifelink gains life though the source dies; first strike kills the blocker before it deals damage back; double strike deals in both sub-steps; vigilance attacker stays untapped; haste attacks the turn it entered; summoning sickness → `'illegalAttacker'`; defender can't attack but can block; indestructible survives lethal damage; protection-from-red can't be blocked by a red creature; an attacker whose only blocker died deals **no** damage to the player.
- **Commander damage** (4): 3 × 7 from one commander = loss at 21; 10 + 11 from two different commanders is *not* a loss; non-combat damage from a commander doesn't count; commander damage to a planeswalker doesn't count.
- **SBAs** (9): 0 toughness from `-1/-1` counters; lethal damage destroys; 0 life loses; draw from an empty library loses on the *next* SBA pass, not immediately; legend rule prompts even for two identical copies; token in a graveyard ceases to exist after "dies" triggers could see it; `+1/+1` and `-1/-1` annihilate; aura with no legal object falls off; last player standing wins.
- **Tier 3** (8): `ManualMoveCard` hand → battlefield; token creation and the token vanishing when moved off the battlefield; arbitrary named counters; life adjust; manual tap/untap; manual P/T override feeding `derive()` at layer 7b; a `ManualAction` marker appears in the log with the intent verbatim; replay after a mixed automatic/manual game yields an identical `stateHash`.
- **Projection** (8): `zones.library[opponent]` is a number; `zones.library[you]` is a number; opponent hand entries are `{hidden:true}` with the correct count; your hand is fully visible; a face-down battlefield card shows `FACE_DOWN_ORACLE_ID` to opponents and the real card to its controller; a card revealed to you appears in `revealed`; `legalActions` is present for you and absent for others; another player's `awaiting` payload is stripped.

**C. Replay-equivalence property test** — the highest-value single test:

```
for seed in 0..499:
  state = createGame(fixed 4-player setup, seed)
  for step in 0..199:
    p = state.priority.awaiting?.player ?? pick from seating
    intent = pick uniformly from legalActions(p) ∪ {PassPriority} ∪ {a random Tier-3 tool, 5% of the time}
    r = handle(state, intent); if !r.ok → continue
    state = fold(apply, r.events); {state, more} = pump(state)
    log.push(...)
    assertInvariants(state)
  assert stateHash(replay(log)) === stateHash(state)
  assert every rng-consuming event: recompute(rngBefore) === {outcome, rngAfter}
  assert log is append-only and seq is dense from 0
```

This one test covers: reducer/handler agreement, `apply` totality, invariant preservation, PRNG self-consistency, and the absence of hidden nondeterminism. A "random legal player" fuzzer over 100 000 intents finds crash bugs no hand-written scenario will.

**D. Networking integration** — host + 4 loopback clients in one process:
- After every `Update`, each client's recomputed `viewHash` equals the host's.
- `diffView` + patch application reproduces `project()` exactly (compare hashes, 500 random updates).
- Kill client 3's transport mid-game, reconnect with the `resumeToken`, assert its post-`Snapshot` `viewHash` equals a fresh `project(state, p3)`.
- A duplicate `intentId` is ignored (no double cast).
- A wrong `resumeToken` is rejected.
- Protocol-version mismatch → `Error{protocolMismatch}`.
- Relay: two rooms don't cross-talk; a frame addressed to `'host'` reaches only the host; a `RelayPeerLeft` fires on socket close.

**E. Golden logs** — check 3–5 recorded real-playtest `.ndjson` logs into `src/engine/__fixtures__/golden/`. A test replays each and asserts the final `stateHash` matches a stored constant. **This is the regression net that catches an accidental rules change**, and it costs one file per playtest. When a golden log legitimately changes (a real rules fix), the diff in the constant forces an explicit decision and a `DECISIONS.md` entry.

### 8.3 Persistence: no SQLite

- **Card data.** Scryfall's "Oracle Cards" bulk file is ~140 MB of JSON. We need exactly two lookups: by `oracleId` and by lowercased name. That is a `Map`, not a database. Ingest once (main process) into a derived index at `%APPDATA%/<app>/cards/oracle-index.v1.json` containing only the ~30 fields of `OracleCard` for **all** oracle cards, all faces — roughly 30–45 MB, ~1–2 s to `JSON.parse`, then resident in memory. With 128 GB RAM, keeping the complete set rather than filtering to Commander-legal cards is the right call under the never-reduce-fidelity rule.
- **Game logs.** NDJSON append: `%APPDATA%/<app>/games/<gameId>.ndjson`, one `LogEntry` per line, written by `HostSession` through an IPC `log.append` call. Append-only on disk mirrors append-only in memory; crash-safe (a torn final line is discarded on load); trivially replayable; human-inspectable in a text editor, which matters enormously when debugging a rules dispute. Optional snapshot every 200 events for fast resume, though replaying 5 000 events takes milliseconds.
- **`sql.js`** already exists in the workspace, but it would add a WASM load and a query language for two key-value lookups. **`better-sqlite3`** would be the workspace's first native module, requiring `asarUnpack` + `electron-rebuild` + a per-Electron-version rebuild step — real ongoing cost for zero benefit here.

**Recommendation: plain JSON index + NDJSON logs. No SQLite of either kind.** Revisit only if a "browse all 30 000 cards with full-text search" feature lands, and even then an in-memory inverted index is likely enough.

### 8.4 Offline-policy exceptions to document

The workspace's `AGENTS.md` requires explicit approval + documentation for any internet dependency. This app needs three entries in its own `AGENTS.md`:

1. **Scryfall bulk data download** (one-time + manual refresh) — user-confirmed in the spec.
2. **Scryfall card art fetch, per deck, cached to disk** — user-confirmed in the spec.
3. **Relay WebSocket + LAN direct-IP hosting** — user-confirmed in the spec. Note the deviation from "dev servers bind localhost only": the LAN host server binds `0.0.0.0:5281` **only** while the user has explicitly started a LAN game, and returns to closed afterward. The Vite dev server still binds localhost.

(Plus the standing `electron-updater` exception.)

---

## 9. Build order, with a verification check per step

Each step is independently verifiable. Steps 1–11 are Vitest-verified; steps 12–14 are CDP-probe-verified because they cross into Electron.

**Step 0 — Scaffold.** Copy the `realmscribe` shape (Electron 41, React 19.2, TS 5.9 strict, Vite 8, zustand, electron-builder NSIS + updater + `create-shortcut.ps1` + `scripts/dev-launcher.cjs` on port 5280). Add `vitest`. Create `docs/DECISIONS.md` (mundifex format: numbered, newest at bottom) seeded with D-NET-1, D-ENG-1, the flat-map choice, computed-derived-values, no-SQLite, and the Vitest adoption.
→ **Verify:** `npm run build` (tsc -b + vite build) exits 0; `npm run test` runs and reports 0 tests; `npm run electron:dev` opens a window.

**Step 1 — `ids`, `rng`, `hash`.**
→ **Verify:** `rng.test.ts` known-answer vectors pass; `nextBelow` unbiased over 10⁶ draws; `canonicalJson` key-order independent.

**Step 2 — Types + `purity.test.ts`.** All of `types/*.ts`, `oracle.ts`, `keywords.ts`. No logic yet.
→ **Verify:** `tsc --noEmit` clean under `strict`; the purity test passes (no React/Electron/Node imports, no `Date.now`/`Math.random` anywhere under `src/engine/`).

**Step 3 — `src/data/` ingest.** `parseManaCost`, `parseTypeLine`, `parseKeywords`, `parseProtection`, `parseManaProduction`, `oracleIndex`.
→ **Verify:** unit tests over ~60 hand-picked cards (basics, Command Tower, Sol Ring, an MDFC, a split card, a `{2/W}` hybrid, a phyrexian card, `protection from red`, `ward {2}`, `plainswalk`, a `*`-P/T card). Then run the real bulk file through it and assert: 0 throws, `producesMana` non-empty for every card whose type line includes `Land` with a basic land type, and print the count of `ingestWarnings` by category — that number is the honest measure of Tier-2 coverage and belongs in `DECISIONS.md`.

**Step 4 — `characteristics` + `EMPTY_REGISTRY` + `scripts/*` type surface.** The layer pipeline with only L1/L7b/L7d live.
→ **Verify:** derive tests — base P/T; `+1/+1` counters; `ptOverride`; face-down = 2/2 colorless; a `*`-P/T card is 0/0 without a script. Plus one **fixture card script** (a fake "Anthem of Testing" giving +1/+0) proving L7c works and that a script is purely additive.

**Step 5 — `zones` + `reducer` (partial) + `assertInvariants` + `log.replay`.** `CardsMoved` and the simple field-setting events only.
→ **Verify:** move a card through all 7 zones, asserting `epoch` increments, battlefield-only fields reset, attachments detach, and `assertInvariants` passes after each; `replay(log)` hash equals the live hash.

**Step 6 — `setup/newGame` + `handlers/setup` + `handlers/mulligan`.**
→ **Verify:** the Setup (6) and Mulligan (5) scenarios.

**Step 7 — `turn` + `sba` + `triggers` + `loop` (`advance`/`pump`) + `legalActions` + auto-pass.** No casting yet — a game that untaps, draws, passes through every step, and ends turns.
→ **Verify:** the Turn structure (8) and SBA (9) scenarios; a 4-player game runs 40 turns of nothing but passes without hitting `MAX_ITER`; the fixture trigger script fires on `StepBegan{upkeep}` and lands on the stack in APNAP order.

**Step 8 — `mana` + `payment` + `handlers/mana` + `handlers/cast` + `stack` + `handlers/priority`.**
→ **Verify:** the Mana + casting (10) and Stack + priority (8) scenarios; a `payment.bench.test.ts` asserting Tier-C MCMF completes in < 1 ms on a synthetic 40-source board (the complexity bound, actually measured rather than asserted).

**Step 9 — `handlers/combat` + combat damage.**
→ **Verify:** the Combat matrix (16) and Commander damage (4) scenarios. This is the step where the test table earns its cost — sixteen keyword interactions is exactly the kind of surface that regresses silently.

**Step 10 — `handlers/manual` (all Tier-3 tools) + `handlers/util`.**
→ **Verify:** the Tier 3 (8) scenarios, especially "replay after a mixed automatic/manual game yields an identical hash."

**Step 11 — `project` + `redactEvent` + `diffView` + the replay-equivalence property test.**
→ **Verify:** the Projection (8) scenarios; then the property test — 500 seeds × 200 intents, asserting invariants after every event, replay-hash equality, and PRNG self-consistency. **This is the gate: do not proceed to networking until it is green**, because every networking bug becomes unfalsifiable if the engine itself is nondeterministic.

**Step 12 — `src/net/protocol` + `loopbackTransport` + `host` + `client` + `lobby`.** Still no sockets.
→ **Verify:** the Networking integration (D) tests with 4 loopback clients — per-update hash agreement, patch fidelity, disconnect/reconnect resync, duplicate-intent idempotence.

**Step 13 — `relay/` package + `relayTransport`.**
→ **Verify:** Vitest test that boots `relay/src/server.js` on port 5282 in-process, connects 4 real `ws` clients, and plays a scripted 10-turn game end to end; asserts room isolation, `to`-routing, presence, and that killing and restarting the relay mid-game lets all four clients resync. Plus a grep assertion that nothing under `relay/` imports `src/engine`.

**Step 14 — Electron integration: `electron/lanServer.cjs`, `preload.cjs` bridge, NDJSON persistence, `window.__cz` dev handles.**
→ **Verify:** `scripts/probe.cjs` in the `ancient-script-picker` pattern — headless Electron loads `dist/index.html`, and via `window.__cz` handles (`{ host, client, session, actions }`, exposed under `import.meta.env.DEV` exactly as `mundifex/src/App.tsx` does, because probes that import modules get HMR ghost instances):
1. host a game with 4 loopback seats and assert `view.zones.library[you]` is a number;
2. start the LAN server, connect a second in-process `ws` client, play three turns, assert hash agreement;
3. kill and reconnect that client, assert resync;
4. assert the NDJSON file exists and `replay()` of it reproduces the live hash;
5. assert the offline audit — no non-`file://` request except the Scryfall host and the relay/LAN origin.

**Step 15 — DECISIONS.md + AGENTS.md.** Record every flagged decision (Q1–Q13 answers), the offline exceptions, the port map, and the Vitest/CDP test-split convention.
→ **Verify:** a fresh read of `AGENTS.md` alone is sufficient to run, test, and probe the app.

---

## Decisions that need the user's call

| # | Question | Recommendation |
|---|---|---|
| **Q0** | App name / directory (`H:\Claude Apps\<appname>`), used for the `window.__xx` handle, `.xx` file extension, product name. | — |
| **Q1** | Client-side reduction: accept **D-NET-1** (clients render a projected view + advisory narration; only the host reduces)? This is the biggest architectural fork. | **Accept.** Rationale in §0. |
| **Q2** | Free first mulligan (common Commander house rule, not in the CR)? | Default **on**, exposed as `GameOptions.freeFirstMulligan`. |
| **Q3** | Rule 903.9a — commander going to graveyard/exile: auto-return to the command zone, prompt each time, or never? | Default **`'ask'`** with a per-game "always do this" toggle. Prompting once teaches the rule; auto-returning silently hides a real choice. |
| **Q4** | Which "etc." Tier-2 keywords to enforce beyond the named list? Candidates: landwalk, fear, intimidate, skulk, shadow, horsemanship, hexproof, shroud, ward, phasing, changeling. | Enforce **landwalk, fear, intimidate, skulk, shadow, horsemanship** (all pure combat-legality checks, ~10 lines each). Enforce **ward** as a cast-time tax prompt. Treat **hexproof/shroud** as display-only until card scripts exist (nothing targets in v1). Skip **phasing** and **changeling** (they need continuous-effect machinery). |
| **Q5** | Combat damage assignment: always automatic, or prompt the attacker when there's a real choice (multiple blockers)? | Default **automatic**, with a per-player stop "let me assign combat damage" that pre-fills the automatic answer. |
| **Q6** | A disconnected player whose input the game is waiting on: pause indefinitely, auto-pass after N seconds, or let any player click "pass for Bob"? | **Pause indefinitely** with a visible banner + a "pass for <name>" button available to everyone (friends-only; social pressure is the right mechanism, and every such pass is an event in the log). |
| **Q7** | Group-approved rewind (`RequestRewind` → `RewoundTo`, re-fold the log, keep full history on disk)? | **Yes, build it.** For a deliberately-partial rules engine this is the highest-value single feature; the append-only log makes it nearly free. |
| **Q8** | Restricted mana ("spend this mana only on…") — ignore in v1? | **Ignore.** Model the pool as plain counts; such sources are marked `conditional` and excluded from auto-tap. Revisit only with card scripts. |
| **Q9** | Confirm rule 103.7: the starting player skips their first draw **only** in a two-player game; with 3–4 players nobody skips. | Encode as written; surface it in the first turn's log line so it's visibly deliberate. |
| **Q10** | Opponent-hand instance ids: real ids (tiny leak — reveals that a specific card returned to hand, and rough draw recency) or per-viewer HMAC pseudonyms? | **Real ids** for v1 (friends-only). Pseudonyms are ~10 lines if it ever matters. |
| **Q11** | The relay operator can read all traffic in aggregate. Add optional AES-GCM over `Envelope.body` with a room-code-derived key (WebCrypto, no new dependency)? | **Defer**, but leave the `Envelope.body` boundary opaque so it can be added without touching the engine or the relay's routing. |
| **Q12** | Partner / Background / "Friends forever" — accept two commanders per player? | **Yes.** `commanderIds: InstanceId[]` and per-instance commander damage already support it at zero cost; the lobby just needs to allow two. |
| **Q13** | Log format version + oracle version mismatch on join: hard-reject (current design) or warn and continue? | **Hard-reject.** Two players on different Scryfall snapshots can disagree about oracle text, which produces an unfalsifiable dispute mid-game. |

---

### Critical Files for Implementation

- `H:\Claude Apps\commandzone\src\engine\types\state.ts` — `GameState`, `PlayerState`, `Zones`, `TurnState`, `PriorityState`, `CombatState`, `StackObject`, `PendingCast`, `GameOptions`. Everything else is downstream of these shapes; get them right first.
- `H:\Claude Apps\commandzone\src\engine\types\events.ts` — the `EventBody` union. The append-only log, the trigger bus, replay, and narration all key off this one type; adding an event later is cheap, changing one is not.
- `H:\Claude Apps\commandzone\src\engine\loop.ts` — `advance()` / `pump()` / auto-pass. The priority + SBA + trigger-drain closure lives here; it is the only place the engine decides to stop and wait for a human.
- `H:\Claude Apps\commandzone\src\engine\project.ts` — `project()` / `redactEvent()` / `diffView()`. The entire hidden-information boundary is this file; a bug here leaks hands.
- `H:\Claude Apps\commandzone\src\net\host.ts` — `HostSession`: the only place intents, the reducer, the log, projection, and the transports meet.

Reference files worth reading before starting: `H:\Claude Apps\mundifex\src\App.tsx` (lines 41–55, the `window.__mx` dev-handle pattern), `H:\Claude Apps\ancient-script-picker\scripts\probe.cjs` (the headless-Electron probe + offline-audit pattern), `H:\Claude Apps\mundifex\docs\DECISIONS.md` (the decisions-log format), and `H:\Claude Apps\realmscribe\package.json` (the current Electron 41 / React 19 / Vite 8 scaffold to copy).