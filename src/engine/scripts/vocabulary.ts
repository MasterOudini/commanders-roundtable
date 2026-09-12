/**
 * D344 - THE VOCABULARY PAYLOAD.
 *
 * A generated row whose payload sentence the engine's own effect vocabulary
 * reads whole ("Destroy target artifact.", "Return target creature card from
 * your graveyard to your hand.", "Create a 1/1 white Soldier creature token.")
 * hands that sentence to the executor a spell uses instead of re-implementing
 * it as a row kind: the def declares `vocabularyTargets(payload)` as its
 * clauses (asked as the trigger stacks, CR 603.3d; validated for an activated
 * ability off the parsed face, D161) and resolves with
 * `ctx.vocabulary(obj, vocabularyEffects(payload, name), targets)`.
 *
 * ⚠️ BOTH HELPERS PARSE ONCE AT MODULE LOAD AND THROW BY NAME. A payload the
 * vocabulary does not read whole must never reach a def (D90: half-executing
 * is worse than not executing), and the refusals below are the ones the ctx
 * method cannot honour at resolution:
 *   - `mode !== 'auto'` - a clause the vocabulary does not understand;
 *   - a clause that ASKS (discard, scry, surveil, look at the top) - the
 *     executor stops at an `AwaitingSet`, and an ability's resolution has no
 *     continuation for the answer (that is the script-raised prompt seam);
 *   - RANDOMNESS ("at random") - `resolve` returns events alone, so an RNG
 *     advance made inside it would never be recorded and the game would not
 *     replay (`effects.ts` on `effectResult` vs `effectEvents`);
 *   - a SELF clause of a kind that needs an aim and is not `SELF_AIMED` - the
 *     executor would resolve it for nothing. (D373: a self pump, a counter on
 *     the source, a self bounce or untap and a regeneration ARE self-aimed:
 *     the executor aims them at the recipient, CR 113.7a - and a quoted body's
 *     leading "it" / lowercase "this creature" is spelled `~` here, before the
 *     parse, because only here is the text known to be a quoted body.)
 * `vocabularyTargets` refuses a clause that is not confident: an unread word
 * in "target creature with a bounty counter on it" would let the prompt
 * offer a creature the card does not allow.
 */
import { parseEffects } from '../../data/effectParse';
import { parseTargetClauses } from '../../data/targetParse';
import { SELF_AIMED } from '../types/oracle';
import type { EffectKind, EffectSpec, TargetSpec } from '../types/oracle';

/** The kinds whose resolution stops and asks (`effectParse.ts`'s ASKS, one seam over). */
const ASKS: ReadonlySet<EffectKind> = new Set(['discard', 'lookAtTop', 'scry', 'surveil', 'search', 'payOptional']);

/** The kinds the executor resolves against an AIM; a self clause of one of these does nothing. */
const NEEDS_AIM: ReadonlySet<EffectKind> = new Set([
  'damage',
  'destroy',
  'exile',
  'counter',
  'bounce',
  'pump',
  'tap',
  'untap',
  'regenerate',
  'putCounters',
  'removeCounters',
  'returnFromGraveyard',
  'reanimate',
  'controllerLosesLife',
  'controllerDraws',
  // D399 - aimed at the attacker-to-be; the self form is in SELF_AIMED.
  'cantBeBlocked',
]);

/**
 * D373 - a QUOTED body names its recipient the way a printed ability names its card:
 * "this creature" in lowercase after a trigger's head (which `selfRef` does not read)
 * and a leading "it" ("Whenever this creature attacks, it gets +1/+0"). Spelled `~`
 * HERE, where the text is known to be a quoted body - `effectParse` must never read
 * "it" on a spell, where it is the previous sentence's target. Only the subject
 * positions of the self-aimed shapes are rewritten.
 */
function recipientAsSelf(payload: string): string {
  return payload
    .replace(/\bthis (?:creature|permanent|artifact|enchantment|land)\b/g, '~')
    .replace(/^it (deals|gets|gains|explores|doesn't)\b/i, '~ $1')
    .replace(/^(return|regenerate|untap|tap) it\b/i, '$1 ~')
    .replace(/\bon it\.$/i, 'on ~.');
}

/**
 * The effect specs of a printed payload sentence, or a throw naming the card
 * and the sentence.
 */
export function vocabularyEffects(payload: string, name: string): readonly EffectSpec[] {
  const parsed = parseEffects(recipientAsSelf(payload), name, true);
  if (parsed.mode !== 'auto' || parsed.effects.length === 0) {
    throw new Error(`${name}: the vocabulary does not read "${payload}" whole (${parsed.mode}) - a row must not claim it (D90).`);
  }
  if (/\bat random\b/i.test(payload)) {
    throw new Error(`${name}: "${payload}" uses randomness, which a def's resolve cannot thread onto the event (the game would not replay).`);
  }
  for (const [i, effect] of parsed.effects.entries()) {
    // D349 - an ask is allowed as the LAST effect and nowhere else. `effectEvents` stops at the prompt, so
    // a clause written after one would be dropped in silence (D344 refused every ask for that reason); with
    // the ask last there is nothing to drop, which is D195's rule for spells and how a trigger has raised
    // the discard since D285. Anywhere else it is still the continuation seam, and still a throw.
    if (ASKS.has(effect.kind) && i !== parsed.effects.length - 1) {
      throw new Error(`${name}: "${payload}" asks (${effect.kind}) before its last clause - a prompt with a clause after it would be dropped, which is the continuation seam.`);
    }
    // D373 - a self clause of a SELF_AIMED kind is aimed at the source by the executor; the refusal
    // stays for the aimable kinds that have no subject without a target clause.
    if (effect.self && NEEDS_AIM.has(effect.kind) && !SELF_AIMED.has(effect.kind)) {
      throw new Error(`${name}: "${payload}" is a self clause of a kind that needs an aim (${effect.kind}) - the executor would resolve it for nothing.`);
    }
  }
  return parsed.effects;
}

/**
 * The target clauses of a printed payload sentence, in printed order, every
 * one confident - or a throw naming the clause.
 */
export function vocabularyTargets(payload: string): readonly TargetSpec[] {
  const clauses = parseTargetClauses(payload);
  const unread = clauses.find((c) => !c.confident);
  if (unread) {
    throw new Error(`the clause "${unread.text}" in "${payload}" is not confident - a row must not claim it (D90).`);
  }
  return clauses;
}
