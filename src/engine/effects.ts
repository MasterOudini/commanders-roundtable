// Turning a parsed effect into EVENTS — the last step of "the spell actually
// does something".
//
// ⚠️ EVENTS ONLY, never a mutation. That is the same contract the card-script
// API states for itself: an effect returns what happened, and `apply` is the one
// function that changes state. It is also what keeps a resolving Lightning Bolt
// replayable — the log carries the outcome, not an instruction to recompute one.
//
// ⚠️ Called ONLY for a face whose `effectMode` is `auto`, i.e. every sentence of
// it was understood. A partly-understood card never reaches here; it becomes the
// prompt bar's one-click offer instead, marked manual in the log. See
// `effectParse.ts` for why half-executing is the failure that matters.

import { derive, type DeriveCache } from './derive';
import type { EngineDeps } from './loop';
import type { EventBody, ResolvedDamage } from './types/events';
import type { InstanceId, PlayerId } from './types/ids';
import type { EffectSpec } from './types/oracle';
import type { GameState, StackObject, TargetChoice } from './types/state';
// Every line here has a CARD as its subject ("Lightning Bolt counters Negate."),
// so none of them changes person for the reader and none needs parts.
import { narrated } from './narrate';
import { drawFromTop } from './setup';

/** The thing a clause is pointed at, already checked for still being there. */
type Aim =
  | { readonly kind: 'card'; readonly id: InstanceId; readonly controller: PlayerId; readonly owner: PlayerId }
  | { readonly kind: 'player'; readonly id: PlayerId }
  | { readonly kind: 'stack'; readonly id: string };

function aimOf(state: GameState, choice: TargetChoice | undefined): Aim | null {
  if (!choice) return null;
  if (choice.kind === 'player') {
    return state.players[choice.id] && !state.players[choice.id]?.hasLost
      ? { kind: 'player', id: choice.id }
      : null;
  }
  if (choice.kind === 'stack') {
    return state.stack.some((s) => s.id === choice.id) ? { kind: 'stack', id: choice.id } : null;
  }
  const card = state.cards[choice.id];
  if (!card) return null;
  return { kind: 'card', id: choice.id, controller: card.controller, owner: card.owner };
}

/**
 * Every event one resolving object's effects produce.
 *
 * ⚠️ A clause whose target has gone is SKIPPED, not guessed at. CR 608.2b only
 * fizzles the whole spell when EVERY target is illegal — a two-target spell that
 * lost one still resolves for the other, and the one that went is simply not
 * affected.
 */
export function effectEvents(
  state: GameState,
  deps: EngineDeps,
  obj: StackObject,
  effects: readonly EffectSpec[],
  cache?: DeriveCache,
): EventBody[] {
  const out: EventBody[] = [];
  const controller = obj.controller;
  const source = obj.card ?? obj.source;

  for (const effect of effects) {
    const aim = effect.self ? null : aimOf(state, obj.targets[effect.targetIndex]);
    if (!effect.self && !aim) continue;

    switch (effect.kind) {
      case 'damage': {
        if (!aim || aim.kind === 'stack' || !source) break;
        out.push({ t: 'DamageDealt', damages: [damageTo(state, deps, source, aim, effect.amount, cache)] });
        break;
      }

      case 'destroy': {
        if (aim?.kind !== 'card') break;
        // ⚠️ Indestructible is a Tier-2 keyword the engine already knows, and
        // "destroy" is precisely the word it answers. Skipping the check would
        // make the app wrong about a keyword it advertises.
        const d = derive(state, deps.oracle, deps.scripts, aim.id, cache);
        if (d.keywords.has('indestructible')) {
          out.push(
            narrated(
              `${obj.label} cannot destroy ${d.name} — it is indestructible.`,
              obj.controller,
              obj.identity,
            ),
          );
          break;
        }
        out.push(moveTo(aim.id, 'graveyard', aim.owner));
        break;
      }

      case 'exile': {
        if (aim?.kind !== 'card') break;
        // Exile is not destruction: indestructible does not save it (CR 701.10a).
        out.push(moveTo(aim.id, 'exile', aim.owner));
        break;
      }

      case 'bounce': {
        if (aim?.kind !== 'card') break;
        out.push(moveTo(aim.id, 'hand', aim.owner));
        break;
      }

      case 'counter': {
        if (aim?.kind !== 'stack') break;
        const victim = state.stack.find((s) => s.id === aim.id);
        if (!victim) break;
        out.push({ t: 'SpellCountered', stackId: victim.id });
        // A countered SPELL goes to its owner's graveyard; an ability just ceases.
        if (victim.card) {
          const vc = state.cards[victim.card];
          if (vc) out.push(moveFromStack(victim.card, 'graveyard', vc.owner));
        }
        out.push(narrated(`${obj.label} counters ${victim.label}.`, obj.controller, obj.identity));
        break;
      }

      case 'pump': {
        if (aim?.kind !== 'card') break;
        out.push({
          t: 'PtModifiedUntilEndOfTurn',
          card: aim.id,
          power: effect.power,
          toughness: effect.toughness,
        });
        break;
      }

      case 'tap': {
        if (aim?.kind !== 'card') break;
        if (state.cards[aim.id]?.tapped) break;
        out.push({ t: 'PermanentsTapped', cards: [aim.id] });
        break;
      }

      case 'untap': {
        if (aim?.kind !== 'card') break;
        if (!state.cards[aim.id]?.tapped) break;
        out.push({ t: 'PermanentsUntapped', cards: [aim.id] });
        break;
      }

      case 'draw': {
        out.push(...drawEvents(state, controller, effect.amount));
        break;
      }

      case 'gainLife': {
        const p = state.players[controller];
        if (!p) break;
        out.push({ t: 'LifeChanged', player: controller, delta: effect.amount, to: p.life + effect.amount });
        break;
      }

      case 'loseLife': {
        if (aim?.kind !== 'player') break;
        const p = state.players[aim.id];
        if (!p) break;
        out.push({ t: 'LifeChanged', player: aim.id, delta: -effect.amount, to: p.life - effect.amount });
        break;
      }
    }
  }
  return out;
}

/**
 * Build the damage record, reusing the SAME shape combat damage uses so infect,
 * wither, deathtouch, lifelink and the commander tally behave identically.
 *
 * ⚠️ `isCommanderDamage` is FALSE here even when the source is a commander:
 * CR 903.10a counts only COMBAT damage toward the 21. A Bolt from your commander
 * is not commander damage, and counting it would kill people early in a way that
 * is very hard to argue with after the fact.
 */
function damageTo(
  state: GameState,
  deps: EngineDeps,
  source: InstanceId,
  aim: Aim,
  amount: number,
  cache?: DeriveCache,
): ResolvedDamage {
  const d = state.cards[source] ? derive(state, deps.oracle, deps.scripts, source, cache) : null;
  const infect = d?.keywords.has('infect') ?? false;
  const wither = d?.keywords.has('wither') ?? false;
  const applyAs = aim.kind === 'player' && infect ? 'poison' : infect || wither ? 'wither' : 'normal';
  return {
    source,
    target: aim.kind === 'player' ? { kind: 'player', id: aim.id } : { kind: 'card', id: (aim as { id: InstanceId }).id },
    amount,
    deathtouch: d?.keywords.has('deathtouch') ?? false,
    lifelinkTo: d?.keywords.has('lifelink') ? state.cards[source]?.controller ?? null : null,
    isCommanderDamage: false,
    viaTrample: 0,
    toxic: d?.toxicAmount ?? 0,
    applyAs,
  };
}

function moveTo(card: InstanceId, kind: 'graveyard' | 'exile' | 'hand', player: PlayerId): EventBody {
  return {
    t: 'CardsMoved',
    moves: [{ card, from: { kind: 'battlefield', player: null }, to: { kind, player } }],
  };
}

function moveFromStack(card: InstanceId, kind: 'graveyard', player: PlayerId): EventBody {
  return {
    t: 'CardsMoved',
    moves: [{ card, from: { kind: 'stack', player: null }, to: { kind, player } }],
  };
}

/**
 * Draw N, or lose on the next state-based action if the library cannot pay.
 *
 * ⚠️ Drawing from an empty library does NOT lose the game here — it sets the
 * flag and the SBA does it (CR 704.5b). Doing it inline would skip the pass that
 * every other loss goes through.
 */
function drawEvents(state: GameState, player: PlayerId, count: number): EventBody[] {
  const library = state.zones.library[player] ?? [];
  // ⚠️ The SAME helper the draw step and the mulligan use. A second "take N off
  // the top" would eventually disagree about which end of the array is the top,
  // and the disagreement would only show up as a shuffled-looking library.
  const out: EventBody[] = [...drawFromTop(player, count, library)];
  if (library.length < count) out.push({ t: 'DrewFromEmptyLibrary', player });
  return out;
}
