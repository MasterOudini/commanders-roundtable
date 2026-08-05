// Who attacks, and who blocks.
//
// ⚠️ EVERY CHOICE COMES OUT OF THE PROMPT, never out of the view's own reading
// of the board. `declareAttackers` carries `attackers` and `defenders`, and
// `declareBlockers` carries the legal `blocker → attackers` pairings, both
// precomputed by the host precisely because a client cannot derive them:
// `canAttack` and `canBlock` read DERIVED keywords off a `GameState` that no
// client holds. The view supplies power, toughness and printed keywords for the
// arithmetic and nothing else. That is also what makes cheating structurally
// impossible here, and the tests assert it directly — every pairing returned
// must appear in the prompt's own list.
//
// ⚠️ M6.2 replaced the P/T arithmetic with `creatureValue`, so combat and
// casting price a creature the same way. Before this, a 2/2 deathtouch and a 2/2
// vanilla were the same blocker and the same attacker.

import type { InstanceId, PlayerId } from '../engine/types/ids';
import type { Awaiting, DefenderRef } from '../engine/types/state';
import type { CardView, PlayerView } from '../view/types';
import { creatureValue, pressure } from './eval';

type AttackPrompt = Extract<Awaiting, { kind: 'declareAttackers' }>;
type BlockPrompt = Extract<Awaiting, { kind: 'declareBlockers' }>;

export interface Attack {
  readonly card: InstanceId;
  readonly defender: DefenderRef;
}
export interface Block {
  readonly blocker: InstanceId;
  readonly attacker: InstanceId;
}

const power = (c: CardView | undefined): number => c?.power ?? 0;
const toughness = (c: CardView | undefined): number => c?.toughness ?? 0;
const kw = (c: CardView | undefined): Set<string> =>
  new Set((c?.card?.keywords ?? []).map((k) => k.toLowerCase()));

/** Untapped creatures a player controls — everything that could block. */
function possibleBlockers(view: PlayerView, player: PlayerId): CardView[] {
  const ids = view.zones[`bf:${player}`] ?? [];
  const out: CardView[] = [];
  for (const id of ids) {
    const card = view.cards[id];
    // ⚠️ Summoning sickness does NOT stop a creature blocking (CR 302.6), so
    // filtering on it here would make the bot attack into a fresh wall of
    // blockers it had convinced itself were not there.
    if (card && card.power !== null && !card.tapped) out.push(card);
  }
  return out;
}

/**
 * Could this creature block that one? An ESTIMATE, and deliberately labelled.
 *
 * ⚠️ THE ONE PLACE IN THE BOT THAT GUESSES AT A RULE, and it has to: the attack
 * prompt says who may attack and says nothing about who may block, so planning
 * an attack means predicting a block declaration that has not happened. It reads
 * PRINTED keywords off the view, so a granted evasion (which needs layer 6, D82,
 * and does not exist yet) is invisible to it — the same blindness the client's
 * own ward lookup lives with.
 *
 * ⚠️ It errs toward "yes". A blocker wrongly assumed possible makes the bot
 * cautious; a blocker wrongly assumed impossible makes it attack into a trade it
 * cannot see coming, and the second mistake loses creatures. Nothing here is
 * ever used as a legality claim — `chooseBlocks` reads the host's real pairings.
 */
function couldBlock(attacker: CardView, blocker: CardView): boolean {
  const a = kw(attacker);
  const b = kw(blocker);
  if (a.has('flying') && !b.has('flying') && !b.has('reach')) return false;
  if (a.has('shadow') !== b.has('shadow')) return false;
  if (a.has('horsemanship') && !b.has('horsemanship')) return false;
  if (a.has('skulk') && power(blocker) > power(attacker)) return false;
  return true;
}

/** Does `killer` kill `victim` outright in one combat exchange? */
function kills(killer: CardView, victim: CardView): boolean {
  if (kw(victim).has('indestructible')) return false;
  if (kw(killer).has('deathtouch') && power(killer) > 0) return true;
  return power(killer) >= toughness(victim) - victim.damage;
}

/**
 * What this creature connecting is worth: damage, and the commander clock.
 *
 * ⚠️ DAMAGE IS A CLOCK, NOT A ONE-OFF, and `CLOCK` is the whole of that. An
 * unblocked creature that survives connects again next turn and the turn after;
 * pricing a hit at face value against a creature priced at power + toughness
 * told the bot that trading was always better than attacking, and it stopped
 * attacking — measured at 9.8 attackers per game against a RANDOM opponent's
 * 12.3, while winning only 62.5%.
 */
const CLOCK = 2;

/**
 * How much of my life I am willing to leave exposed to the swing back.
 *
 * ⚠️ MEASURED, NOT CHOSEN. Both constants were swept over 100-game matchups
 * against level 0 and the winners baked in — the M6 brief's "tune it by playing,
 * not by taste". `CLOCK` 1/2/3 gave 74%/78%/78%; `SAFETY` 0.25/0.5/0.75/1.0 gave
 * 76%/79%/79%/77%.
 *
 * ⚠️ AND THE KNOBS COULD NOT STAY. They were `process.env` reads during the
 * sweep, which `purity.node.test.ts` bans in `src/bot/` — so a tuning knob left
 * behind fails the build rather than shipping as configuration nobody sets. That
 * is the guard working: these are constants with a measurement beside them, not
 * settings.
 */
const SAFETY = 0.5;

function damageValue(view: PlayerView, attacker: CardView, defenderId: PlayerId, me: PlayerId): number {
  const cmdBonus = attacker.isCommander ? 1 + (view.seats[defenderId]?.cmdDamage[me] ?? 0) / 21 : 1;
  return power(attacker) * cmdBonus * CLOCK;
}

/** What one blocker meeting one attacker is worth TO THE ATTACKER. */
function exchangeValue(attacker: CardView, blocker: CardView): number {
  const iDie = kills(blocker, attacker);
  const theyDie = kills(attacker, blocker);
  // Trample still gets the overflow through, which is why it is worth blocking
  // around rather than into.
  const spill = kw(attacker).has('trample') ? Math.max(0, power(attacker) - toughness(blocker)) : 0;
  return spill + (theyDie ? creatureValue(blocker) : 0) - (iDie ? creatureValue(attacker) : 0);
}

/**
 * What ATTACKING WITH THIS WHOLE SET is worth, once the defender has blocked as
 * well as they can.
 *
 * ⚠️ THE SET, NOT EACH ATTACKER ALONE, and that distinction is the whole of
 * M6.2's combat. The first version priced every attacker against the defender's
 * single best blocker and refused the attack if that one exchange was bad — so
 * ONE well-placed creature vetoed a swing by five, and the bot attacked barely
 * more often than a random one (measured: 12.3 attackers per game against
 * random's 10.0). A defender has a fixed number of blockers and must SPEND them;
 * everything past that number connects. Modelling that is what makes a bot
 * attack when it is ahead on board, which is how Magic games are won.
 *
 * ⚠️ The defender is assumed to block GREEDILY and well: best blocker first,
 * onto whichever attacker gains them the most. That is not optimal play (the
 * true problem is an assignment, and it is theirs to solve) but it is the right
 * direction to be wrong in — it makes the bot slightly too cautious rather than
 * slightly too optimistic.
 */
function attackSetValue(
  view: PlayerView,
  attackers: readonly CardView[],
  defenderId: PlayerId,
  blockers: readonly CardView[],
  me: PlayerId,
): number {
  const unassigned = new Set(attackers.map((c) => c.instanceId));
  const assignment = new Map<InstanceId, CardView>();

  const theirs = [...blockers].sort((a, b) => {
    const d = creatureValue(b) - creatureValue(a);
    return d !== 0 ? d : a.instanceId.localeCompare(b.instanceId);
  });

  for (const blocker of theirs) {
    let best: CardView | undefined;
    let bestGain = 0;
    for (const attacker of attackers) {
      if (!unassigned.has(attacker.instanceId)) continue;
      if (!couldBlock(attacker, blocker)) continue;
      // The defender's gain is the attacker's loss, plus the damage they stop.
      const stopped = kw(attacker).has('trample')
        ? Math.min(power(attacker), toughness(blocker))
        : power(attacker);
      const gain = stopped - exchangeValue(attacker, blocker);
      if (gain > bestGain) {
        bestGain = gain;
        best = attacker;
      }
    }
    if (best) {
      assignment.set(best.instanceId, blocker);
      unassigned.delete(best.instanceId);
    }
  }

  let total = 0;
  for (const attacker of attackers) {
    const blocker = assignment.get(attacker.instanceId);
    total += blocker
      ? exchangeValue(attacker, blocker)
      : damageValue(view, attacker, defenderId, me);
  }
  return total;
}

/**
 * Attack when it is worth it, and keep enough at home to survive the swing back.
 */
export function chooseAttacks(view: PlayerView, prompt: AttackPrompt, me: PlayerId): Attack[] {
  const seats = prompt.defenders
    .filter((d): d is DefenderRef & { kind: 'player' } => d.kind === 'player')
    // ⚠️ Never myself. The prompt should not offer it, and a bot that attacked
    // its own seat because it did would be unexplainable from the table.
    .filter((d) => d.id !== me && !view.seats[d.id]?.lost);

  // Whoever is closest to dying — by life, or by MY commander damage, whichever
  // clock is further along. A seat on 30 life and 18 commander damage is two
  // swings from dead and the life total does not say so.
  const defender = [...seats].sort((a, b) => {
    const left = (s: PlayerId): number =>
      Math.min(view.seats[s]?.life ?? 40, (21 - (view.seats[s]?.cmdDamage[me] ?? 0)) * 1.5);
    const d = left(a.id) - left(b.id);
    return d !== 0 ? d : a.id.localeCompare(b.id);
  })[0];
  if (!defender) return [];

  const theirs = possibleBlockers(view, defender.id);
  const candidates = prompt.attackers
    .map((id) => view.cards[id])
    .filter((c): c is CardView => c !== undefined && power(c) > 0);

  // Lethal beats every other consideration: if everything that can attack adds
  // up to their life total and they have nothing to block with, swing.
  const totalPower = candidates.reduce((s, c) => s + power(c), 0);
  if (theirs.length === 0 && totalPower >= (view.seats[defender.id]?.life ?? Infinity)) {
    return candidates
      .sort((a, b) => a.instanceId.localeCompare(b.instanceId))
      .map((c) => ({ card: c.instanceId, defender }));
  }

  // ⚠️ HOW MUCH I HAVE TO KEEP AT HOME, and it is a COUNT rather than a flag.
  // Everything that attacks without vigilance is tapped on the way back, so a
  // bot that always attacked with everything has nothing to block with — which
  // is exactly what happened once the clock weighting made it aggressive:
  // 13.9 attackers a game and 4.4 blocks, letting most of an 11-attacker swing
  // straight through. The old rule only held anything back when the board was
  // ALREADY lethal, which is one turn too late to matter.
  //
  // The rule: look at what every opponent could swing back with, biggest first,
  // and keep enough blockers that what gets through is inside `SAFETY` of my
  // life total.
  const theirThreats = view.seatOrder
    .filter((p) => p !== me && !view.seats[p]?.lost)
    .flatMap((p) => possibleBlockers(view, p))
    .map((c) => power(c))
    .filter((p) => p > 0)
    .sort((a, b) => b - a);
  const afford = (view.seats[me]?.life ?? 40) * SAFETY;
  let unblocked = theirThreats.reduce((s, p) => s + p, 0);
  let reserve = 0;
  for (const threat of theirThreats) {
    if (unblocked <= afford) break;
    unblocked -= threat;
    reserve++;
  }

  // ⚠️ A vigilant creature attacks and still blocks, so it is never part of the
  // reserve — and neither is one that cannot block usefully. The reserve is taken
  // from the BEST blockers, because a bad blocker held back is a wasted attack
  // and a good one is the whole point.
  const reservable = candidates
    .filter((c) => !kw(c).has('vigilance') && toughness(c) > 0)
    .sort((a, b) => {
      const d = creatureValue(b) - creatureValue(a);
      return d !== 0 ? d : a.instanceId.localeCompare(b.instanceId);
    });
  const held = new Set(reservable.slice(0, reserve).map((c) => c.instanceId));
  const available = candidates.filter((c) => !held.has(c.instanceId));

  // ⚠️ DROP THE WORST ATTACKER UNTIL THE SET IS WORTH IT, rather than filtering
  // each attacker independently. Whether a creature should attack depends on
  // what else is attacking beside it — a 2/2 that would be eaten alone is fine
  // in a swing of six, because the blocker that would have eaten it is busy.
  // Ordered by how much each contributes on its own, so the first thing dropped
  // is the one that was carrying least.
  let set = [...available].sort((a, b) => {
    const d = damageValue(view, b, defender.id, me) - damageValue(view, a, defender.id, me);
    return d !== 0 ? d : a.instanceId.localeCompare(b.instanceId);
  });
  while (set.length > 0 && attackSetValue(view, set, defender.id, theirs, me) < 0) {
    set = set.slice(0, -1);
  }

  return set
    .sort((a, b) => a.instanceId.localeCompare(b.instanceId))
    .map((c) => ({ card: c.instanceId, defender }));
}

/**
 * Block to survive, and to trade up.
 *
 * ⚠️ Every pair is taken from `prompt.legal`, and a blocker is used once. What
 * this deliberately cannot see is MENACE: "this attacker needs two blockers" is
 * a property of the whole declaration, checked by `validateBlockDeclaration`
 * rather than by `canBlock`, so it is not in the pairing list. That is why the
 * caller has a second attempt that declares no blocks at all — a legal answer
 * always available, and the reason a rejected block cannot wedge the game.
 */
export function chooseBlocks(view: PlayerView, prompt: BlockPrompt, me: PlayerId): Block[] {
  const attackerIds = new Set<InstanceId>();
  for (const row of prompt.legal) for (const a of row.attackers) attackerIds.add(a);

  const incoming = [...attackerIds]
    .map((id) => view.cards[id])
    .filter((c): c is CardView => c !== undefined && c.attacking === me)
    // Biggest threat first: it is the one most worth spending a blocker on.
    .sort((a, b) => {
      const d = power(b) - power(a);
      return d !== 0 ? d : a.instanceId.localeCompare(b.instanceId);
    });

  const totalIncoming = incoming.reduce((s, c) => s + power(c), 0);
  const need = pressure(view, me, totalIncoming);

  const used = new Set<InstanceId>();
  const out: Block[] = [];
  let stopped = 0;

  for (const attacker of incoming) {
    const candidates = prompt.legal
      .filter((row) => !used.has(row.blocker) && row.attackers.includes(attacker.instanceId))
      .map((row) => view.cards[row.blocker])
      .filter((c): c is CardView => c !== undefined);
    if (candidates.length === 0) continue;

    // ⚠️ Priced the same way an attack is: what I lose against what they lose.
    // The old rule was "kills it and survives", which never blocked a 5/5 with
    // two 3/3s and never chump-blocked anything that was not lethal.
    const scored = candidates
      .map((blocker) => {
        const iDie = kills(attacker, blocker);
        const theyDie = kills(blocker, attacker);
        const saved = kw(attacker).has('trample')
          ? Math.min(power(attacker), toughness(blocker))
          : power(attacker);
        return {
          blocker,
          value:
            (theyDie ? creatureValue(attacker) : 0) -
            (iDie ? creatureValue(blocker) : 0) +
            // ⚠️ DAMAGE PREVENTED IS WORTH NOTHING WHILE I AM SAFE, and that
            // reads like a bug until it is measured. At a full life total `need`
            // is 0, so an even trade — block a 2/2 with a 2/2, both die — scores
            // exactly 0 and is declined; the bot blocks about four times against
            // an eleven-attacker swing and takes the rest on the chin.
            //
            // Paying it a flat rate was tried and is WORSE: at 0.5 and 1.0 the
            // win rate fell from 79% to 75% and 74%, the bot dropped from 14.0
            // attackers a game to 12.8, and the opponent finished on 4.4 life
            // instead of 1.1. It was blocking instead of racing, and in a game
            // where both seats start on 40 the race is what closes it. A creature
            // held back to make an even trade is a creature not attacking.
            saved * need,
        };
      })
      .sort((a, b) => {
        const d = b.value - a.value;
        return d !== 0 ? d : a.blocker.instanceId.localeCompare(b.blocker.instanceId);
      });

    const best = scored[0];
    if (!best) continue;

    // ⚠️ SURVIVAL IS A RULE, NOT A WEIGHT, and it is here because weighting it
    // did not work. While the damage on the table is lethal the bot blocks
    // whatever it can, at any price, because a creature is worth nothing to a
    // player who is dead.
    //
    // The weighted version failed a position a human answers instantly: eight
    // life against a 4/4 and a 4/4, holding a 2/2 and a 2/4 — every trade scores
    // zero or worse, so it declined both blocks and died. Raising the chump
    // multiplier fixes that position and LOSES games (the tournament measured
    // 79% → 77% at ×2), because it also chump-blocks when it is merely behind.
    // A threshold cannot be both. So: trades are priced, and not dying is not a
    // trade.
    const mustSurvive = totalIncoming - stopped >= (view.seats[me]?.life ?? 40);
    if (best.value <= 0 && !mustSurvive) continue;

    // When surviving is the point, spend the CHEAPEST body that stops the most
    // damage rather than the best trade — the good creatures are worth keeping
    // for the turn after the one this buys.
    const chosen = mustSurvive && best.value <= 0
      ? [...scored].sort((a, b) => {
          const d = creatureValue(a.blocker) - creatureValue(b.blocker);
          return d !== 0 ? d : a.blocker.instanceId.localeCompare(b.blocker.instanceId);
        })[0]!
      : best;

    used.add(chosen.blocker.instanceId);
    out.push({ blocker: chosen.blocker.instanceId, attacker: attacker.instanceId });
    // ⚠️ Trample still gets through, so a chump block against one stops only
    // what the blocker's toughness soaks. Counting the whole attack would let
    // the bot think it had survived and stop blocking.
    stopped += kw(attacker).has('trample')
      ? Math.min(power(attacker), toughness(chosen.blocker))
      : power(attacker);
  }
  return out;
}
