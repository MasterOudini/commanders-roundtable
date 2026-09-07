// D355 — THE MANA ABILITY'S PRICE. `{T}: Add {R} or {W}. This land deals 1 damage to you.` is the
// painland cycle; the Talismans are its artifact spelling. The engine tapped both and added the
// mana without ever dealing the damage, which is exactly why `engineComplete` refused the line and
// every one of these cards was incomplete — D90's rule catching the engine rather than a card.
//
// What is proven here, in the order the line travels:
//   · the PARSER reads the price off the line it already reads, and reads nothing else as one;
//   · the HANDLER charges it in the same action as the mana, because a mana ability does not use
//     the stack (CR 605.1) and there is no window between the two;
//   · the UNPRICED line on the same card is untouched — a painland's `{T}: Add {C}` is free, and a
//     patch that charged both would be worse than one that charged neither;
//   · the ACCOUNTING claims the priced line, which is the whole coverage move.
import { describe, expect, test } from 'vitest';
import { faceOf } from './oracle';
import { manaSourcesOf } from './mana';
import { engineCompleteness } from '../data/engineComplete';
import { ORACLE, must, put, startedGame } from './testing/harness';

function face(name: string) {
  const card = ORACLE.byName(name);
  if (!card) throw new Error(`no fixture ${name}`);
  return faceOf(card, 0);
}
function data(name: string) {
  const card = ORACLE.byName(name);
  if (!card) throw new Error(`no fixture ${name}`);
  return card.data;
}

describe('a mana ability with a price (D355)', () => {
  // ── the parse ──────────────────────────────────────────────────────────────
  test('the painland reads two productions and prices only the coloured one', () => {
    const prods = face('Battlefield Forge').producesMana;
    expect(prods).toHaveLength(2);
    // `{T}: Add {C}.` — no second sentence, no price.
    expect(prods[0]?.drawback ?? null).toBeNull();
    // `{T}: Add {R} or {W}. This land deals 1 damage to you.`
    expect(prods[1]?.drawback).toEqual({ kind: 'damageToYou', amount: 1 });
    expect(prods[1]?.outputs).toHaveLength(2);
  });

  test('the artifact spelling reads the same price', () => {
    const prods = face('Talisman of Curiosity').producesMana;
    expect(prods[1]?.drawback).toEqual({ kind: 'damageToYou', amount: 1 });
  });

  test('an ordinary land has no price at all', () => {
    for (const p of face('Forest').producesMana) expect(p.drawback ?? null).toBeNull();
  });

  // ── the charge ─────────────────────────────────────────────────────────────
  test('tapping for the priced mana deals the damage in the same action', () => {
    const game = startedGame({ decks: [['Battlefield Forge']] });
    const land = put(game, 'p1', 'Battlefield Forge');
    const before = game.state.players['p1']?.life ?? 0;
    const sources = manaSourcesOf(game.state, ORACLE, game.deps.scripts, 'p1').filter((s) => s.card === land);
    const priced = sources.find((s) => s.drawback);
    expect(priced).toBeDefined();
    must(game.submit({ t: 'TapForMana', player: 'p1', card: land, abilityIndex: priced!.abilityIndex, outputChoice: 0 }));
    expect(game.state.players['p1']?.life).toBe(before - 1);
    // The mana is there too — the price is charged BESIDE the mana, never instead of it.
    expect(game.state.players['p1']?.pool.R).toBe(1);
    expect(game.state.cards[land]?.tapped).toBe(true);
  });

  test("the same land's colourless line is free", () => {
    const game = startedGame({ decks: [['Battlefield Forge']] });
    const land = put(game, 'p1', 'Battlefield Forge');
    const before = game.state.players['p1']?.life ?? 0;
    const free = manaSourcesOf(game.state, ORACLE, game.deps.scripts, 'p1')
      .filter((s) => s.card === land)
      .find((s) => !s.drawback);
    expect(free).toBeDefined();
    must(game.submit({ t: 'TapForMana', player: 'p1', card: land, abilityIndex: free!.abilityIndex, outputChoice: 0 }));
    expect(game.state.players['p1']?.life).toBe(before);
    expect(game.state.players['p1']?.pool.C).toBe(1);
  });

  test('it is DAMAGE dealt by the land, not a life payment', () => {
    // ⚠️ The distinction is load-bearing and the card says it: "deals 1 damage to you". Damage can
    // be prevented, redirected and noticed by a damage trigger; a life payment cannot. Emitting
    // `LifeChanged` would have produced the same life total and the wrong rules object.
    const game = startedGame({ decks: [['Yavimaya Coast']] });
    const land = put(game, 'p1', 'Yavimaya Coast');
    const priced = manaSourcesOf(game.state, ORACLE, game.deps.scripts, 'p1')
      .filter((s) => s.card === land)
      .find((s) => s.drawback);
    const res = game.submit({ t: 'TapForMana', player: 'p1', card: land, abilityIndex: priced!.abilityIndex, outputChoice: 0 });
    must(res);
    const damage = res.ok
      ? res.events.filter((e) => e.body.t === 'DamageDealt')
      : [];
    expect(damage).toHaveLength(1);
    const body = damage[0]?.body;
    expect(body?.t === 'DamageDealt' && body.damages[0]?.source).toBe(land);
    expect(body?.t === 'DamageDealt' && body.damages[0]?.target).toEqual({ kind: 'player', id: 'p1' });
    expect(body?.t === 'DamageDealt' && body.damages[0]?.amount).toBe(1);
  });

  // ── the accounting ─────────────────────────────────────────────────────────
  test('the priced line is accounted for, and that is the coverage move', () => {
    expect(engineCompleteness(data('Battlefield Forge')).complete).toBe(true);
    expect(engineCompleteness(data('Talisman of Curiosity')).complete).toBe(true);
  });

  test('a drawback the engine cannot apply keeps its line unaccounted', () => {
    // ⚠️ THE BOUNDARY, held by a real card. `Thalakos Lowlands` reads
    // "{T}: Add {W} or {U}. This land doesn't untap during your next untap step." — a delayed state
    // this decision does not build. It must stay INCOMPLETE: a vocabulary that quietly widened to
    // "any second sentence" would claim it and the engine would untap the land anyway.
    const c = engineCompleteness(data('Thalakos Lowlands'));
    expect(c.complete).toBe(false);
    expect(c.leftover.some((l) => /doesn't untap/i.test(l))).toBe(true);
    for (const p of face('Thalakos Lowlands').producesMana) expect(p.drawback ?? null).toBeNull();
  });
});
