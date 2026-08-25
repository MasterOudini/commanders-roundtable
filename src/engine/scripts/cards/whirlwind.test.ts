// `Whirlwind` — every flyer dies, whoever controls it; a grounded creature
// lives.
//
// ⚠️ This is the batch's positive control for the flying predicate. Its
// batch-mates `Wing Snare` and `Wing Puncture` are REFUSED for the same word
// in a TARGET noun, where the aim layer drops it silently. Same keyword, two
// fates, and the difference is only where it sits.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { WHIRLWIND_SCRIPT } from './whirlwind';
import { WHIRLWIND } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Whirlwind';
const FLYER = 'Serra Angel'; // 4/4 flying
const GROUNDED = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(): { g: Game; myFlyer: InstanceId; theirFlyer: InstanceId; grounded: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      [SPELL, FLYER, GROUNDED],
      [FLYER],
    ],
    scripts: createRegistry([WHIRLWIND_SCRIPT]),
  });
  const myFlyer = put(g, 'p1', FLYER);
  const grounded = put(g, 'p1', GROUNDED);
  const theirFlyer = put(g, 'p2', FLYER);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 6 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, myFlyer, theirFlyer, grounded };
}

describe('Whirlwind', () => {
  test('every flyer dies, mine with theirs', () => {
    const { g, myFlyer, theirFlyer } = cast();
    expect(g.state.cards[myFlyer]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[theirFlyer]?.zone.kind).toBe('graveyard');
  });

  test('a grounded creature lives', () => {
    const { g, grounded } = cast();
    expect(g.state.cards[grounded]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = WHIRLWIND.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, WHIRLWIND.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(WHIRLWIND.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cast();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
