// How good is this position for me?
//
// ⚠️ THE EVALUATION FUNCTION IS WHERE THE STRENGTH LIVES — more than the search,
// which is the M6 brief's own claim and the reason M6.2 builds this before M6.5
// builds any lookahead. Everything level 1 decides that is not forced now comes
// through here: which spell to cast, which creatures to attack with, which
// blocks to make.
//
// ⚠️ THE UNIT IS LIFE. One point of score is one point of life, so every term
// below is commensurable and a weight can be argued about in words: "a 2/2 is
// worth about four life" is a claim somebody can disagree with, where "a 2/2 is
// worth 37" is not. It also means the numbers this returns are readable in a
// test failure.
//
// ⚠️ ME MINUS THE BEST OPPONENT, never me minus the sum. Commander is a
// free-for-all and you lose to whoever is ahead, so a seat that is crushing one
// opponent while a third player builds a board is not winning. Summing would
// tell it that it was.
//
// ⚠️ PURE, DETERMINISTIC, AND ORDER-FREE. Zones are iterated through
// `view.zones[...]`, which is explicitly ordered, and never through
// `Object.keys(view.cards)` — that order is a function of patch order, which is
// deterministic today and not obviously so, and a `diffView` change could
// silently reorder it.

import type { PlayerId } from '../engine/types/ids';
import type { CardView, PlayerView, ZoneId } from '../view/types';
import { parseTypeLine } from '../data/oracleParse';

/**
 * What a creature on the battlefield is worth, in life.
 *
 * A vanilla 2/2 comes to 4. Evasion is worth more than raw size because the
 * damage actually lands, and a creature that cannot attack is worth much less
 * than its body suggests.
 */
export function creatureValue(card: CardView): number {
  const power = card.power ?? 0;
  const toughness = card.toughness ?? 0;
  if (power === 0 && toughness === 0) return 0;
  let value = power + toughness;

  const keywords = new Set((card.card?.keywords ?? []).map((k) => k.toLowerCase()));
  // Evasion: this power is damage that will be dealt rather than damage that
  // will be blocked, so it multiplies the half of the body that attacks.
  if (keywords.has('flying') || keywords.has('fear') || keywords.has('intimidate') || keywords.has('shadow')) {
    value += power;
  } else if (keywords.has('menace') || keywords.has('trample') || keywords.has('skulk')) {
    value += power * 0.5;
  }
  // Damage multipliers and damage that comes back.
  if (keywords.has('double strike')) value += power;
  if (keywords.has('first strike')) value += 1;
  if (keywords.has('lifelink')) value += power * 0.5;
  // Deathtouch makes a small body trade with anything, which is most of what a
  // blocker is for.
  if (keywords.has('deathtouch')) value += 2;
  if (keywords.has('vigilance')) value += 1;
  if (keywords.has('indestructible')) value += 3;
  // ⚠️ A defender is a wall: it holds the ground and never closes a game. Its
  // toughness is doing all the work, so the power half of the body is not.
  if (keywords.has('defender')) value -= power;
  // Summoning sickness is temporary, and pricing it too high makes the bot
  // undervalue everything it just cast.
  if (card.summoningSick && !keywords.has('haste')) value -= 1;
  // Damage already marked comes off at cleanup, but right now it is how close
  // this creature is to dying.
  value -= Math.min(card.damage, toughness);

  // ⚠️ THE COMMANDER IS NOT WORTH MORE THAN ITS BODY. It comes back — that is
  // the point of the command zone — so a bot that priced it as irreplaceable
  // would refuse every profitable attack it could make with the best creature it
  // owns. Commander DAMAGE is where the commander's real value is scored, below.
  return Math.max(0, value);
}

/** Creatures a player controls, in the zone's own order. */
function creaturesOf(view: PlayerView, player: PlayerId): CardView[] {
  const out: CardView[] = [];
  for (const id of view.zones[`bf:${player}`] ?? []) {
    const card = view.cards[id];
    if (card && card.power !== null) out.push(card);
  }
  return out;
}

/**
 * ⚠️ THE LARGER OF THE TWO, NEVER THE SUM. An opponent's hand is in BOTH —
 * `project.ts` keeps the real ids in `zones` (with `card: null`, so geometry is
 * right) AND writes the length into `hiddenCounts`. Adding them reads every
 * opponent as holding twice the cards they do, which is exactly the kind of
 * quiet doubling an evaluation function can carry for a long time while only
 * ever being a bit wrong.
 */
function countIn(view: PlayerView, zone: ZoneId): number {
  return Math.max((view.zones[zone] ?? []).length, view.hiddenCounts[zone] ?? 0);
}

function isLand(card: CardView): boolean {
  const face = card.card?.faces[0];
  return face ? parseTypeLine(face.typeLine).types.includes('Land') : false;
}

/**
 * How well ONE seat is doing, in life-equivalent points.
 *
 * ⚠️ Everything here is public information or the viewer's own — creature
 * bodies, life, poison, land counts, hand SIZE. It never reads an opponent's
 * hand CONTENTS, which projection does not give it anyway. That is what makes
 * this safe to run over every seat.
 */
function seatScore(view: PlayerView, player: PlayerId): number {
  const seat = view.seats[player];
  if (!seat || seat.lost) return -1000;

  let score = 0;

  // Board. The dominant term, because a board wins games and life only survives
  // them.
  for (const card of creaturesOf(view, player)) score += creatureValue(card);

  // Life, at less than face value: 40 life with no board is losing, and the
  // last few points are worth far more than the first few.
  score += seat.life * 0.35;
  // Ten poison is death, so each counter is a tenth of a life total.
  score -= seat.poison * 3;

  // Mana development, with diminishing returns — the eighth land is worth much
  // less than the third, and a bot that valued them equally would keep playing
  // lands over spells.
  const lands = (view.zones[`bf:${player}`] ?? []).filter((id) => {
    const card = view.cards[id];
    return card !== undefined && isLand(card);
  }).length;
  score += Math.sqrt(lands) * 2;

  // Card advantage. A card in hand is worth about a point and a half of life;
  // an empty hand is how a game is lost from a winning board.
  score += countIn(view, `hand:${player}`) * 1.5;

  // ⚠️ THE COMMANDER CLOCK, and it is why the commander is worth playing rather
  // than why it is worth protecting. 21 damage is a whole second life total, so
  // every point dealt is worth roughly two of the 40 — and the closer it gets,
  // the more each one is worth, because the last point wins outright.
  for (const [dealer, amount] of Object.entries(seat.cmdDamage)) {
    if (dealer === player) continue;
    score -= amount * 0.8 + (amount >= 14 ? amount : 0) * 0.4;
  }

  return score;
}

/**
 * The position from `me`'s side. Positive is winning.
 *
 * ⚠️ Losing seats are excluded from "the best opponent" rather than scored at
 * minus a thousand, or a bot that had knocked one player out would read the
 * table as won and stop developing.
 */
export function scorePosition(view: PlayerView, me: PlayerId): number {
  const mine = seatScore(view, me);
  let best = -Infinity;
  for (const player of view.seatOrder) {
    if (player === me) continue;
    if (view.seats[player]?.lost) continue;
    best = Math.max(best, seatScore(view, player));
  }
  // Everybody else is dead. That is the best position there is.
  if (best === -Infinity) return 1000;
  return mine - best;
}

/**
 * How badly this seat needs to stabilise, 0…1.
 *
 * ⚠️ Read by the blocker: at 0 the bot trades only when the trade is good, and
 * at 1 it will chump-block with anything, because a creature is worth nothing to
 * a player who is dead. Driven by life ALONE rather than by the score, because
 * the question is "am I about to die", not "am I behind".
 */
export function pressure(view: PlayerView, me: PlayerId, incoming: number): number {
  const life = view.seats[me]?.life ?? 40;
  if (incoming <= 0) return 0;
  if (incoming >= life) return 1;
  // Two more turns of this and I am dead.
  return Math.min(1, incoming / Math.max(1, life / 2.5));
}
