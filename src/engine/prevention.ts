/**
 * Prevention shields — CR 615.
 *
 * ⚠️ **A PREVENTION EFFECT IS A REPLACEMENT EFFECT** (CR 615.1), and that is the
 * whole reason this lives where it does. D233 wrote the tripwire that made the
 * gap honest: the engine's ONE prevention site was `combat.ts`'s
 * `preventedAmount` (protection, CR 702.16c), which only the combat-damage
 * assignment consults, so `Pinpoint Avalanche`'s "The damage can't be
 * prevented." executed as NOTHING and every burn shipped on that argument was
 * safe only while it stayed true.
 *
 * ⚠️ **AND IT COULD NOT BE FIXED AT THE EMITTER.** Hundreds of shipped card
 * modules build a `DamageDealt` themselves, so a shield consulted inside
 * `effects.ts`'s `damageTo` would be skipped by every one of them — a Fog that
 * stops an attack and not a scripted ping. The funnel is the one place every
 * event passes through, which is what makes this correct by construction rather
 * than by a list of call sites kept in step.
 *
 * ⚠️ **THE WHOLE BATCH, NOT ONE EVENT** — `withoutCountersOfTheUncounterable`'s
 * shape (D336). `applyReplacements` is handed one body at a time against a state
 * that does not advance between them, so two damage events in one batch would
 * each see the same unspent shield and both consume it. The shields are walked
 * once over the batch, with a working ledger.
 *
 * ⚠️ **PREVENTED DAMAGE IS NOT DEALT AT ALL** (CR 615.1), so an entry reduced to
 * zero is DROPPED and an event left with no entries is dropped with it: a
 * watcher must not see a damage event carrying nothing, and a lifelink or a
 * damage trigger must not fire for damage that never happened.
 *
 * ⚠️ **THE ORDER IS THE BATCH'S, and CR 615.5 says the affected player chooses**
 * when two shields could apply. D134's fallback, for D134's reason: a
 * deterministic order that replays, with the choice named as unbuilt rather than
 * quietly taken. A shield is spent in the order it was created.
 */
import type { EventBody, ResolvedDamage } from './types/events';
import type { GameState, PreventionShield } from './types/state';
import { narrated } from './narrate';

/** Does this shield stand between that source and that target? */
function covers(shield: PreventionShield, entry: ResolvedDamage, isCombat: boolean): boolean {
  if (shield.combatOnly && !isCombat) return false;
  const r = shield.recipient;
  if (r.kind === 'any') return true;
  if (r.kind === 'players') return entry.target.kind === 'player';
  if (r.kind === 'player') return entry.target.kind === 'player' && entry.target.id === r.id;
  return entry.target.kind === 'card' && entry.target.id === r.id;
}

/**
 * Rewrite a batch so prevented damage is never dealt, and say what each shield
 * spent. Returns the batch unchanged when nothing applies.
 */
export function withoutPreventedDamage(state: GameState, bodies: readonly EventBody[]): readonly EventBody[] {
  if (state.preventionShields.length === 0) return bodies;
  if (!bodies.some((b) => b.t === 'DamageDealt' || b.t === 'CombatDamageDealt')) return bodies;

  // The working ledger: 'all' never runs out this turn, a number shrinks.
  const left = new Map<string, number | 'all'>();
  for (const s of state.preventionShields) left.set(s.id, s.amount);

  const out: EventBody[] = [];
  const spends = new Map<string, number>();
  let preventedTotal = 0;

  for (const body of bodies) {
    if (body.t !== 'DamageDealt' && body.t !== 'CombatDamageDealt') {
      out.push(body);
      continue;
    }
    const isCombat = body.t === 'CombatDamageDealt';
    const kept: ResolvedDamage[] = [];
    for (const entry of body.damages) {
      if (entry.unpreventable === true) {
        kept.push(entry);
        continue;
      }
      let remaining = entry.amount;
      for (const shield of state.preventionShields) {
        if (remaining <= 0) break;
        const l = left.get(shield.id);
        if (l === undefined || (l !== 'all' && l <= 0)) continue;
        if (!covers(shield, entry, isCombat)) continue;
        const taken = l === 'all' ? remaining : Math.min(l, remaining);
        if (taken <= 0) continue;
        remaining -= taken;
        preventedTotal += taken;
        spends.set(shield.id, (spends.get(shield.id) ?? 0) + taken);
        if (l !== 'all') left.set(shield.id, l - taken);
      }
      if (remaining <= 0) continue;
      kept.push(remaining === entry.amount ? entry : { ...entry, amount: remaining });
    }
    if (kept.length > 0) out.push({ ...body, damages: kept });
  }

  if (preventedTotal === 0) return bodies;
  out.push(narrated(`${preventedTotal} damage is prevented.`, null));
  out.push({ t: 'DamagePrevented', spends: [...spends].map(([id, amount]) => ({ id, amount })) });
  return out;
}
