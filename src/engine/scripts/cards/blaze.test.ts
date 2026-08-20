// `Blaze` — X damage at any target: X=4 kills a 2/2's owner nothing, and a
// player takes it on the face.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { BLAZE_SCRIPT } from './blaze';
import { BLAZE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(x: number, targetPlayer: boolean): Game {
  const g = startedGame({
    players: 2,
    decks: [['Blaze'], ['Grizzly Bears']],
    scripts: createRegistry([BLAZE_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Blaze', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: x + 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, xValue: x }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(
    g.submit({
      t: 'ChooseTargets',
      player: 'p1',
      targets: [targetPlayer ? { kind: 'player', id: 'p2' } : { kind: 'card', id: bears }],
    }),
  );
  settle(g);
  return g;
}

describe('Blaze', () => {
  test('X=4 at a 2/2 kills it', () => {
    const g = cast(4, false);
    expect((g.state.zones.graveyard['p2'] ?? []).length).toBe(1);
  });

  test('X=4 at a player takes 4 life', () => {
    const g = cast(4, true);
    expect(g.state.players['p2']?.life).toBe(36);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = BLAZE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, BLAZE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(BLAZE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const g = cast(3, true);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
