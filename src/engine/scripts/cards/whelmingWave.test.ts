// `Whelming Wave` — the four named subtypes stay; everything else goes home,
// mine included.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { WHELMING_WAVE_SCRIPT } from './whelmingWave';
import { WHELMING_WAVE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Whelming Wave';
const BEARS = 'Grizzly Bears';
const RING = 'Sol Ring'; // not a creature — must stay
const SERPENT = 'Iceridge Serpent'; // a SPARED subtype

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(): {
  g: Game;
  mine: InstanceId;
  theirs: InstanceId;
  ring: InstanceId;
  serpent: InstanceId;
} {
  const g = startedGame({
    players: 2,
    decks: [
      [SPELL, BEARS, RING],
      [BEARS, SERPENT],
    ],
    scripts: createRegistry([WHELMING_WAVE_SCRIPT]),
  });
  const mine = put(g, 'p1', BEARS);
  const ring = put(g, 'p1', RING);
  const theirs = put(g, 'p2', BEARS);
  const serpent = put(g, 'p2', SERPENT);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 6 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, mine, theirs, ring, serpent };
}

describe('Whelming Wave', () => {
  test('every ordinary creature goes home, mine with theirs', () => {
    const { g, mine, theirs } = cast();
    expect(g.state.cards[mine]?.zone.kind).toBe('hand');
    expect(g.state.cards[theirs]?.zone.kind).toBe('hand');
  });

  test('a SERPENT is spared by name — the card lists its own exceptions', () => {
    const { g, serpent } = cast();
    expect(g.state.cards[serpent]?.zone.kind).toBe('battlefield');
  });

  test('a non-creature is untouched', () => {
    const { g, ring } = cast();
    expect(g.state.cards[ring]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = WHELMING_WAVE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, WHELMING_WAVE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(WHELMING_WAVE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cast();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
