// `Star of Extinction` — the land dies, then every creature takes 20.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { STAR_OF_EXTINCTION_SCRIPT } from './starOfExtinction';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function extinct(): { g: Game; swamp: InstanceId; titan: InstanceId; mine: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Star of Extinction', 'Grizzly Bears'], ['Swamp', 'Grave Titan']],
    scripts: createRegistry([STAR_OF_EXTINCTION_SCRIPT]),
  });
  const mine = put(g, 'p1', 'Grizzly Bears');
  const swamp = put(g, 'p2', 'Swamp');
  const titan = put(g, 'p2', 'Grave Titan');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Star of Extinction', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 7 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: swamp }] }));
  settle(g);
  return { g, swamp, titan, mine };
}

describe('Star of Extinction', () => {
  test('the land dies and both boards of creatures burn', () => {
    const { g, swamp, titan, mine } = extinct();
    expect(g.state.cards[swamp]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[titan]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[mine]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = extinct();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
