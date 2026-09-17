// D482 - THE PLAYER'S SACRIFICE. `Target opponent sacrifices a creature of their choice` (Cruel Edict) is D390's queue over
// the ONE player the spell aimed at: a `target` scope the resolution resolves to the aimed player, who chooses; and
// `Each player sacrifices two creatures of their choice` (Barter in Blood) is the same queue with a count. What is
// proven here: the vocabulary's readings (the target scope, the count, a head's `of target player's choice`); Cruel
// Edict aimed at p2 with two creatures asks p2 and takes what p2 named, the Giant stays; aimed at p2 with one creature
// it asks nobody; Barter in Blood takes two of p1's three by p1's answer and both of p2's two unasked; the replay hash.
import { describe, expect, test } from 'vitest';
import { parseEffects } from '../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import { replay, stateHash } from './log';

const settle = (g: ReturnType<typeof startedGame>) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.pendingAsks === null && s.priority.awaiting === null, 20_000);

describe("D482 - the player's sacrifice", () => {
  test('the vocabulary reads the target scope, the count, and the referent spelling', () => {
    const a = parseEffects('Target opponent sacrifices a creature of their choice.', '~', true);
    expect(a.mode).toBe('auto');
    expect(a.effects[0]).toMatchObject({ kind: 'sacrifice', amount: 1, targetIndex: 0, scopes: [{ kind: 'player', controller: 'target' }] });
    expect(a.effects[0]?.sacrifice?.what).toBe('creature');
    const b = parseEffects('Target player sacrifices two creatures of target player\'s choice.', '~', true);
    expect(b.mode).toBe('auto');
    expect(b.effects[0]?.amount).toBe(2);
    const c = parseEffects('Each player sacrifices two creatures of their choice.', '~', true);
    expect(c.mode).toBe('auto');
    expect(c.effects[0]).toMatchObject({ kind: 'sacrifice', amount: 2, scopes: [{ kind: 'player', controller: 'any' }] });
    expect(parseEffects('Target player sacrifices a creature of their choice. You gain 2 life.', '~', true).mode).toBe('assisted');
  });

  test('Cruel Edict asks the aimed opponent, who keeps the Giant', () => {
    const g = startedGame({ players: 2, decks: [['Cruel Edict'], ['Grizzly Bears', 'Hill Giant']] });
    holdEverywhere(g);
    const bears = put(g, 'p2', 'Grizzly Bears');
    const giant = put(g, 'p2', 'Hill Giant');
    const edict = put(g, 'p1', 'Cruel Edict', 'hand');
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: edict, targets: [{ kind: 'player', id: 'p2' }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone', 20_000);
    const ask = g.state.priority.awaiting;
    expect(ask?.kind === 'chooseFromZone' ? ask.player : null).toBe('p2');
    expect(g.submit({ t: 'AnswerChooseFromZone', player: 'p2', cards: [giant] }).ok).toBe(true);
    settle(g);
    expect(g.state.cards[giant]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('with one creature the aimed player is not asked; Barter in Blood asks p1 for two and takes both of p2 unasked', () => {
    const g = startedGame({ players: 2, decks: [['Cruel Edict', 'Barter in Blood', 'Grizzly Bears', 'Hill Giant', 'Coral Eel'], ['Grizzly Bears', 'Hill Giant']] });
    holdEverywhere(g);
    const lone = put(g, 'p2', 'Grizzly Bears');
    const edict = put(g, 'p1', 'Cruel Edict', 'hand');
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: edict, targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(g.state.cards[lone]?.zone.kind).toBe('graveyard');
    // Barter in Blood: p1 three creatures (asked for two), p2 two (both go, unasked).
    const a1 = put(g, 'p1', 'Grizzly Bears');
    const a2 = put(g, 'p1', 'Hill Giant');
    const a3 = put(g, 'p1', 'Coral Eel');
    const b1 = put(g, 'p2', 'Grizzly Bears');
    const b2 = put(g, 'p2', 'Hill Giant');
    const barter = put(g, 'p1', 'Barter in Blood', 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 2 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: barter, targets: [] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone', 20_000);
    const ask = g.state.priority.awaiting;
    expect(ask?.kind === 'chooseFromZone' ? [ask.player, ask.count] : null).toEqual(['p1', 2]);
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [a1, a3] }));
    settle(g);
    expect([a1, a3, b1, b2].map((id) => g.state.cards[id]?.zone.kind)).toEqual(['graveyard', 'graveyard', 'graveyard', 'graveyard']);
    expect(g.state.cards[a2]?.zone.kind).toBe('battlefield');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
