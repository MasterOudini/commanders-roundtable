// `Seething Song` — the ritual at five, proven on its own oracle id.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { SEETHING_SONG_SCRIPT } from './seethingSong';
import { SEETHING_SONG } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Seething Song'], ['Grizzly Bears']],
    scripts: createRegistry([SEETHING_SONG_SCRIPT]),
  });
  const song = put(g, 'p1', 'Seething Song', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: song }));
  settle(g);
  return g;
}

describe('Seething Song', () => {
  test('{2}{R} in, five {R} out', () => {
    const g = cast();
    expect(g.state.players['p1']?.pool.R).toBe(5);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = SEETHING_SONG.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, SEETHING_SONG.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(SEETHING_SONG.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const g = cast();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
