// Level 0: play something legal, chosen at random.
//
// ⚠️ THIS IS A MEASURING STICK, NOT A PRODUCT. The M6 brief is explicit — "it is
// the baseline, not a product. Every later level must beat it ≥ 95% of the
// time." It is not offered in the lobby, because a difficulty called
// "deliberately bad" is not a difficulty; it exists so `tournament.node.test.ts`
// can put a number on how much level 1's decisions are actually worth.
//
// ⚠️ RANDOM, AND STILL PERFECTLY DETERMINISTIC. The RNG is seeded from the
// POSITION — the seat, the state hash and the event count — rather than carried
// as mutable state, so the same board always produces the same "random" choice,
// a bot game replays to the same state hash, and there is nothing to thread
// through the log. That is what lets level 0 sit in `src/bot/`, which may not
// call `Math.random` at all.
//
// ⚠️ It answers PROMPTS through the shared `answerAwaiting`, except the two
// where a random choice is the whole point. Randomising `chooseTargets` or
// `mulliganBottom` would not make a worse player, it would make a player that
// wedges — and D102 is the record of what an unanswered prompt costs. "Random
// where the choice matters, minimal-legal elsewhere" is the honest baseline.

import type { LegalAction } from '../engine/legal';
import type { PlayerId } from '../engine/types/ids';
import type { PlayerView } from '../view/types';
import { nextBelow, seedRng, type RngState } from '../engine/rng';
import { hash64 } from '../engine/hash';
import { answerAwaiting } from './awaiting';
import { planTargets } from './targets';
import { act, wait, type BotConfig, type BotDecision, type BotPort, type BotSnapshot } from './types';

/**
 * A fresh RNG for this exact position.
 *
 * ⚠️ Hashed rather than concatenated, because `seedRng` walks the string and two
 * seats one event apart would otherwise share most of their seed material — and
 * sfc32 warmed from near-identical seeds is not near-identically distributed,
 * it is just correlated in a way nothing here would notice.
 */
function rngFor(snapshot: BotSnapshot, cfg: BotConfig): RngState {
  return seedRng(hash64(`${cfg.seed ?? ''}|${snapshot.you}|${snapshot.stateHash}|${snapshot.eventCount}`));
}

function pick<T>(rng: RngState, xs: readonly T[]): { value: T | undefined; next: RngState } {
  if (xs.length === 0) return { value: undefined, next: rng };
  const { value: i, next } = nextBelow(rng, xs.length);
  return { value: xs[i], next };
}

/** A random subset, each member included on its own coin flip. */
function subset<T>(rng: RngState, xs: readonly T[]): { value: T[]; next: RngState } {
  let s = rng;
  const out: T[] = [];
  for (const x of xs) {
    const { value, next } = nextBelow(s, 2);
    s = next;
    if (value === 0) out.push(x);
  }
  return { value: out, next: s };
}

/**
 * ⚠️ `TapForMana` is excluded, for the same reason `meaningfulActions` excludes
 * it: there is essentially always a land untapped somewhere, so a uniform pick
 * over a list containing twenty of them would tap lands into an emptying pool
 * all game and cast nothing. Level 0 is meant to be bad, not inert — a baseline
 * that never plays is one every policy beats, and it would measure nothing.
 *
 * ⚠️ `ActivateAbility` is excluded too: with `SHIPPED_REGISTRY` its effect never
 * happens (D121), so it is a cost paid for nothing rather than a bad play.
 */
function usable(legal: readonly LegalAction[]): LegalAction[] {
  return legal.filter(
    (a) =>
      a.t === 'PassPriority' ||
      a.t === 'PlayLand' ||
      (a.t === 'CastSpell' && a.affordable && !a.hasX),
  );
}

function randomPriority(
  port: BotPort,
  snapshot: BotSnapshot,
  me: PlayerId,
  view: PlayerView,
  cfg: BotConfig,
): BotDecision {
  const rng = rngFor(snapshot, cfg);
  const options = usable(snapshot.legal);
  const { value: chosen } = pick(rng, options);
  if (!chosen || chosen.t === 'PassPriority') {
    return act({ t: 'PassPriority', player: me }, 'level 0 passes');
  }
  if (chosen.t === 'PlayLand') {
    return act({ t: 'PlayLand', player: me, card: chosen.card, faceIndex: chosen.faceIndex }, `level 0 plays ${chosen.label}`);
  }
  const specs = port.targetSpecsFor(chosen.card);
  // The livelock guard is NOT optional at level 0 either — `legalActions` never
  // looks at targets, so a spell whose clause cannot be filled would be cast,
  // cancelled and offered again forever. Being a bad player is allowed; failing
  // to terminate is not.
  const targets = specs.length > 0 ? planTargets(port, chosen.card, specs, view, me) : [];
  if (targets === null) return act({ t: 'PassPriority', player: me }, 'level 0 cannot aim that');
  const preview = port.previewCast(chosen.card, 0, targets);
  if (!preview?.plan) return act({ t: 'PassPriority', player: me }, 'level 0 cannot pay for that');
  return act(
    {
      t: 'CastSpell',
      player: me,
      card: chosen.card,
      // ⚠️ Narrowed rather than asserted: `usable` returns the whole legal
      // union and only a cast has a face. D155.
      faceIndex: chosen.t === 'CastSpell' ? chosen.faceIndex : 0,
      plan: preview.plan,
      targets,
    },
    `level 0 casts ${chosen.label}`,
  );
}

export function decideRandom(
  port: BotPort,
  snapshot: BotSnapshot,
  cfg: BotConfig,
  attempt = 0,
): BotDecision {
  if (!snapshot.running || snapshot.finished) return wait('the game is not running');
  const me = snapshot.you;
  const view = port.currentView();
  const awaiting = snapshot.awaiting;

  if (awaiting) {
    // ⚠️ Attackers are where a random player is most visibly random, and the one
    // prompt the fuzzer randomises too. A retry declares nothing, which is always
    // legal — the same escape `answerAwaiting` uses.
    if (awaiting.kind === 'declareAttackers' && awaiting.player === me && attempt === 0) {
      const defender = awaiting.defenders.find((d) => d.kind === 'player' && d.id !== me);
      if (!defender) return act({ t: 'DeclareAttackers', player: me, attackers: [] }, 'level 0 has nobody to attack');
      const { value: chosen } = subset(rngFor(snapshot, cfg), awaiting.attackers);
      return act(
        { t: 'DeclareAttackers', player: me, attackers: chosen.map((card) => ({ card, defender })) },
        `level 0 attacks with ${chosen.length}`,
      );
    }
    // ⚠️ Blocks are NOT randomised, and that is the fuzzer's own choice too: a
    // random block declaration is rejected by `validateBlockDeclaration` often
    // enough (menace) that the seat would spend the game on its retry path
    // rather than playing badly. It declares none, which is the weakest legal
    // answer and therefore the right baseline behaviour.
    if (awaiting.kind === 'declareBlockers' && awaiting.players.includes(me) && !awaiting.submitted.includes(me)) {
      return act({ t: 'DeclareBlockers', player: me, blocks: [] }, 'level 0 does not block');
    }
    return answerAwaiting(port, awaiting, me, attempt);
  }

  if (snapshot.priority !== me) return wait('someone else holds priority');
  return randomPriority(port, snapshot, me, view, cfg);
}
