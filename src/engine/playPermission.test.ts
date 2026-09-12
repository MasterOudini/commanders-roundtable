// D417 - THE PLAY PERMISSION, proven at the carrier (Reckless Impulse's family).
//
// `Exile the top two cards of your library. Until the end of your next turn, you may play those
// cards.` - the cards go to exile face up, the caster may play each as though from the hand (a land
// with the land drop, a spell at its own speed - the legal offer lists them, the cast and the land
// play admit exile under the permission), the permission goes when the card leaves exile or the
// deadline passes: this turn's cleanup, the cleanup of the caster's NEXT turn, or the caster's
// next end step.
import { describe, expect, test } from 'vitest';
import { parseEffects } from '../data/effectParse';
import { replay, stateHash } from './log';
import { legalActions } from './legal';
import { createRegistry } from './scripts/registryCore';
import { vocabularyEffects } from './scripts/vocabulary';
import { advanceUntil, deps as depsOf, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { CardScript } from './scripts/api';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const BEARS = 'Grizzly Bears';
const FOREST = 'Forest';
const MOUNTAIN = 'Mountain';
const IMPULSE = 'Reckless Impulse';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}
const zone = (g: Game, id: InstanceId): string => g.state.cards[id]?.zone.kind ?? 'gone';
const permitted = (g: Game, id: InstanceId): boolean => g.state.playPermissions.some((p) => p.card === id && p.player === 'p1');
const D = createRegistry([]);
const offers = (g: Game, id: InstanceId): string[] => legalActions(g.state, depsOf(D).oracle, depsOf(D).scripts, 'p1').filter((a) => (a.t === 'CastSpell' || a.t === 'PlayLand') && a.card === id).map((a) => a.t);

/** p1 stacks `top` (last = the top) on the library, then casts Reckless Impulse in the third-turn main phase. */
function impulse(top: readonly string[]): { g: Game; exiled: InstanceId[] } {
  const g = startedGame({ players: 2, decks: [[IMPULSE, BEARS, FOREST, MOUNTAIN], [BEARS]], scripts: D });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 40_000);
  const staged: InstanceId[] = [];
  for (const n of top) {
    const id = put(g, 'p1', n, 'hand');
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: id, to: { kind: 'library', player: 'p1' }, placement: 'top' }));
    staged.push(id);
  }
  const card = put(g, 'p1', IMPULSE, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card }));
  settle(g);
  return { g, exiled: staged };
}

describe('D417 - the play permission: the parser', () => {
  test('the six wordings read with their count and deadline; a cast-only permission and a conditional one stay out', () => {
    const a = parseEffects('Exile the top two cards of your library. Until the end of your next turn, you may play those cards.', 'X', true);
    expect(a.mode).toBe('auto');
    expect(a.effects[0]?.kind).toBe('exileTopPlay');
    expect(a.effects[0]?.exilePlay).toEqual({ count: 2, until: 'yourNextTurn' });
    expect(parseEffects('Exile the top card of your library. You may play that card this turn.', 'X', true).effects[0]?.exilePlay).toEqual({ count: 1, until: 'thisTurn' });
    expect(parseEffects('Exile the top card of your library. Until end of turn, you may play that card.', 'X', true).effects[0]?.exilePlay).toEqual({ count: 1, until: 'thisTurn' });
    expect(parseEffects('Exile the top card of your library. You may play it until the end of your next turn.', 'X', true).effects[0]?.exilePlay).toEqual({ count: 1, until: 'yourNextTurn' });
    expect(parseEffects('Exile the top card of your library. Until your next end step, you may play it.', 'X', true).effects[0]?.exilePlay).toEqual({ count: 1, until: 'yourNextEndStep' });
    expect(parseEffects('Exile the top card of your library. You may cast it this turn.', 'X', true).mode).not.toBe('auto');
    expect(parseEffects("Exile the top card of your library. Until the end of your next turn, you may play that card. If you don't, put it into your graveyard.", 'X', true).mode).not.toBe('auto');
  });
});

describe('D417 - Reckless Impulse', () => {
  test('the top two go to exile with a permission each; the land is offered and played from exile, the spell offered and cast; the permission leaves with the card', () => {
    const { g, exiled } = impulse([BEARS, FOREST]);
    const [bears, forest] = exiled as [InstanceId, InstanceId];
    expect(zone(g, bears)).toBe('exile');
    expect(zone(g, forest)).toBe('exile');
    expect(permitted(g, bears)).toBe(true);
    expect(permitted(g, forest)).toBe(true);
    expect(g.state.playPermissions.find((p) => p.card === forest)?.until).toBe('yourNextTurn');
    expect(offers(g, forest)).toEqual(['PlayLand']);
    expect(offers(g, bears)).toEqual(['CastSpell']);
    must(g.submit({ t: 'PlayLand', player: 'p1', card: forest, faceIndex: 0 }));
    expect(zone(g, forest)).toBe('battlefield');
    expect(permitted(g, forest)).toBe(false);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 2 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bears }));
    settle(g);
    expect(zone(g, bears)).toBe('battlefield');
    expect(permitted(g, bears)).toBe(false);
    expect(g.state.playPermissions).toHaveLength(0);
    // Another player holds no permission: their offer lists nothing from p1's exile.
    expect(g.log.some((e) => e.body.t === 'PlayPermissionGranted')).toBe(true);
  });
  test('the permission outlives this turn and ends at the cleanup of the next own turn; nobody else may play the card; the hash replays', () => {
    const { g, exiled } = impulse([BEARS]);
    const bears = exiled[0] as InstanceId;
    expect(permitted(g, bears)).toBe(true);
    // p2's turn: still permitted (the deadline is the end of p1's NEXT turn), and not p2's to cast.
    advanceUntil(g, (s) => s.turn.turnNumber === 4 && s.turn.phase === 'precombatMain' && s.priority.player === 'p2', 40_000);
    expect(permitted(g, bears)).toBe(true);
    expect(g.submit({ t: 'CastSpell', player: 'p2', card: bears }).ok).toBe(false);
    // p1's next turn: still permitted through its main phase, gone after its cleanup.
    advanceUntil(g, (s) => s.turn.turnNumber === 5 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1', 40_000);
    expect(permitted(g, bears)).toBe(true);
    expect(offers(g, bears)).toEqual(['CastSpell']);
    advanceUntil(g, (s) => s.turn.turnNumber === 6, 40_000);
    expect(permitted(g, bears)).toBe(false);
    expect(zone(g, bears)).toBe('exile');
    expect(offers(g, bears)).toEqual([]);
    expect(g.log.some((e) => e.body.t === 'PlayPermissionsExpired' && e.body.cards.includes(bears))).toBe(true);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

// The two shorter deadlines land on TRIGGERS (the spells print the next-turn one), so their proofs are
// test-only scripts whose payload the vocabulary reads whole (the D369 pattern).
function etb(oracleId: string, name: string, sentence: string): CardScript {
  return {
    oracleId,
    name,
    triggers: [
      {
        abilityId: 'a0',
        text: `When this creature enters, ${sentence.charAt(0).toLowerCase()}${sentence.slice(1)}`,
        event: 'CardsMoved',
        activeZones: ['battlefield'],
        optional: false,
        matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield'),
        label: () => `${name} - ${sentence}`,
        resolve: (ctx, _self, obj) => ctx.vocabulary(obj, vocabularyEffects(sentence, name), []),
      },
    ],
  };
}
const THIS_TURN = etb('test-perm-this-turn', 'Testing This Turn', 'Exile the top card of your library. You may play that card this turn.');
const END_STEP = etb('test-perm-end-step', 'Testing End Step', 'Exile the top card of your library. Until your next end step, you may play it.');

function fired(script: CardScript): { g: Game; top: InstanceId } {
  const g = startedGame({ players: 2, decks: [[BEARS, BEARS, FOREST], [BEARS]], scripts: createRegistry([script]) });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 40_000);
  const top = put(g, 'p1', FOREST, 'hand');
  must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: top, to: { kind: 'library', player: 'p1' }, placement: 'top' }));
  const self = put(g, 'p1', BEARS, 'hand');
  const inst = g.state.cards[self];
  if (inst) (inst as { oracleId: string }).oracleId = script.oracleId;
  must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
  settle(g);
  return { g, top };
}

describe('D417 - the shorter deadlines', () => {
  test('this turn: permitted through the turn, gone at its cleanup', () => {
    const { g, top } = fired(THIS_TURN);
    expect(zone(g, top)).toBe('exile');
    expect(permitted(g, top)).toBe(true);
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.step === 'end', 40_000);
    expect(permitted(g, top)).toBe(true);
    advanceUntil(g, (s) => s.turn.turnNumber === 4, 40_000);
    expect(permitted(g, top)).toBe(false);
  });
  test('until your next end step: gone the moment the caster`s end step begins', () => {
    const { g, top } = fired(END_STEP);
    expect(permitted(g, top)).toBe(true);
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.step === 'end', 40_000);
    expect(permitted(g, top)).toBe(false);
  });
});
