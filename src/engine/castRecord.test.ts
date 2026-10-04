// D619 - THE CAST RECORD (CR 603.4's `if you cast it`, `if you cast it from your hand`): the zone a permanent's spell
// was cast from rides the resolution move onto the permanent (`castFromZone`), cleared on entry like the kick (D403) - so a
// permanent put onto the battlefield, or one that left and came back, reads nothing. What is proven: a cast from the hand
// records the hand; a put records nothing; the same card put back after a bounce records nothing; the replay hash.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { advanceUntil, fullControl, must, put, startedGame } from './testing/harness';

const BEARS = 'Grizzly Bears';

describe('the cast record (D619)', () => {
  test('a cast from the hand records the hand; a put records nothing, and nothing survives a zone change', () => {
    const g = startedGame({ decks: [['Forest', 'Forest', BEARS, BEARS], ['Forest']], scripts: createRegistry([]) });
    fullControl(g, 'p1');
    const cast = put(g, 'p1', BEARS, 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: cast }));
    advanceUntil(g, (s) => s.cards[cast]?.zone.kind === 'battlefield' && s.stack.length === 0, 400);
    expect(g.state.cards[cast]?.castFromZone).toBe('hand');
    // The second Bears, wherever the opening seven left it (the harness looks off the battlefield first).
    const putIn = put(g, 'p1', BEARS);
    expect(putIn).not.toBe(cast);
    expect(g.state.cards[putIn]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[putIn]?.castFromZone).toBeUndefined();
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: cast, to: { kind: 'hand', player: 'p1' } }));
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: cast, to: { kind: 'battlefield', player: 'p1' } }));
    expect(g.state.cards[cast]?.castFromZone, 'a new object - the record does not survive').toBeUndefined();
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
