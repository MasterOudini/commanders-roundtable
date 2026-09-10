/**
 * Prevention — CR 615, both shapes.
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
 * D385 - **THE CONTINUOUS FORM.** "Prevent all combat damage that would be dealt
 * to this creature." is a static ability that prevents EVERY time and spends
 * nothing - a `PreventionDef` on a battlefield permanent, gated exactly as the
 * static index and the replacement walk gate a source (face-up, and only while
 * it still HAS abilities: CR 613 layer 6). It is asked BEFORE the shields, for
 * the player's own reason: a continuous effect absorbs the whole entry at no
 * cost, so a consumable shield asked first would be spent on damage that was
 * never going to land. CR 615.5's ordering choice is still UNBUILT (D134's
 * fallback, named); this order is deterministic and replays.
 *
 * ⚠️ **THE ORDER IS THE BATCH'S, and CR 615.5 says the affected player chooses**
 * when two shields could apply. D134's fallback, for D134's reason: a
 * deterministic order that replays, with the choice named as unbuilt rather than
 * quietly taken. A shield is spent in the order it was created.
 */
import { derive, makeDeriveCache, makeScriptCtx, type DeriveCache } from './derive';
import { narrated } from './narrate';
import type { PreventionDef, ScriptCtx } from './scripts/api';
import type { ScriptRegistry } from './scripts/registryCore';
import type { EventBody, ResolvedDamage } from './types/events';
import type { InstanceId } from './types/ids';
import type { OracleDb } from './types/oracle';
import type { GameState, PreventionShield } from './types/state';

/** Does this shield stand between that source and that target? */
function covers(shield: PreventionShield, entry: ResolvedDamage, isCombat: boolean): boolean {
  if (shield.combatOnly && !isCombat) return false;
  const r = shield.recipient;
  if (r.kind === 'any') return true;
  if (r.kind === 'players') return entry.target.kind === 'player';
  if (r.kind === 'player') return entry.target.kind === 'player' && entry.target.id === r.id;
  return entry.target.kind === 'card' && entry.target.id === r.id;
}

interface StaticPrevention {
  readonly sourceId: InstanceId;
  readonly def: PreventionDef;
}

const NONE: readonly StaticPrevention[] = [];

/**
 * D385 - every continuous prevention ability in play, in battlefield order.
 * The same gates as `staticSourcesFor` (derive.ts) and `applicableTo`
 * (triggers.ts): a face-down source has no abilities (CR 708.2), and a source
 * that has LOST its abilities prevents nothing (CR 613 layer 6, `hasAbilities`).
 */
function staticPreventions(state: GameState, oracle: OracleDb, scripts: ScriptRegistry, cache: DeriveCache): readonly StaticPrevention[] {
  const defs = scripts.preventions();
  if (defs.length === 0) return NONE;
  const out: StaticPrevention[] = [];
  for (const sourceId of state.zones.battlefield) {
    const source = state.cards[sourceId];
    if (!source || source.faceDown) continue;
    let able: boolean | null = null;
    for (const { script, def } of defs) {
      if (source.oracleId !== script.oracleId) continue;
      if (!def.activeZones.includes(source.zone.kind)) continue;
      if (able === null) able = derive(state, oracle, scripts, sourceId, cache).hasAbilities;
      if (!able) break;
      out.push({ sourceId, def });
    }
  }
  return out;
}

/** A read-only ctx over the batch's own derive cache, for `PreventionDef.prevents`. */
function ctxOver(state: GameState, oracle: OracleDb, scripts: ScriptRegistry, cache: DeriveCache): ScriptCtx {
  return { ...makeScriptCtx(state, oracle, scripts), derive: (id) => derive(state, oracle, scripts, id, cache) };
}

/**
 * Rewrite a batch so prevented damage is never dealt, and say what each shield
 * spent and what each continuous ability absorbed. Returns the batch unchanged
 * when nothing applies.
 */
export function withoutPreventedDamage(
  state: GameState,
  oracle: OracleDb,
  scripts: ScriptRegistry,
  bodies: readonly EventBody[],
): readonly EventBody[] {
  // ⚠️ THE GATE: an empty registry and no shield means no walk at all, which is
  // what keeps a damage batch free for the games that have neither (D368).
  if (state.preventionShields.length === 0 && scripts.preventions().length === 0) return bodies;
  if (!bodies.some((b) => b.t === 'DamageDealt' || b.t === 'CombatDamageDealt')) return bodies;

  const cache = makeDeriveCache(state);
  const statics = staticPreventions(state, oracle, scripts, cache);
  const ctx = statics.length > 0 ? ctxOver(state, oracle, scripts, cache) : null;

  // The working ledger: 'all' never runs out this turn, a number shrinks.
  const left = new Map<string, number | 'all'>();
  for (const s of state.preventionShields) left.set(s.id, s.amount);

  const out: EventBody[] = [];
  const spends = new Map<string, number>();
  const absorbed = new Map<string, { source: InstanceId; abilityId: string; amount: number }>();
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
      // D385 - the continuous abilities first: one that applies absorbs the WHOLE
      // entry and spends nothing, so no shield is asked about damage that was
      // never going to land.
      let stopped = false;
      if (ctx !== null) {
        for (const s of statics) {
          if (!s.def.prevents(ctx, s.sourceId, entry, isCombat)) continue;
          const key = `${s.sourceId}#${s.def.abilityId}`;
          const got = absorbed.get(key) ?? { source: s.sourceId, abilityId: s.def.abilityId, amount: 0 };
          got.amount += entry.amount;
          absorbed.set(key, got);
          preventedTotal += entry.amount;
          stopped = true;
          break;
        }
      }
      if (stopped) continue;
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
  out.push({
    t: 'DamagePrevented',
    spends: [...spends].map(([id, amount]) => ({ id, amount })),
    statics: [...absorbed.values()],
  });
  return out;
}
