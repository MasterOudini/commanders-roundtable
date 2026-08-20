// `Pounce` — Prey Upon's text at instant speed; the fight goes both ways.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { POUNCE_SCRIPT } from './pounce';
import { POUNCE, PREY_UPON } from '../../../data/fixtures/engineCards';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pounced(): { g: Game; mine: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Pounce', 'Colossal Dreadmaw'], ['Grizzly Bears']],
    scripts: createRegistry([POUNCE_SCRIPT]),
  });
  const mine = put(g, 'p1', 'Colossal Dreadmaw');
  const theirs = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  const spell = put(g, 'p1', 'Pounce', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(
    g.submit({
      t: 'CastSpell',
      player: 'p1',
      card: spell,
      targets: [
        { kind: 'card', id: mine },
        { kind: 'card', id: theirs },
      ],
    }),
  );
  settle(g);
  return { g, mine, theirs };
}

describe('Pounce', () => {
  test('shares its printed text with Prey Upon', () => {
    expect(POUNCE.faces[0]?.oracleText).toBe(PREY_UPON.faces[0]?.oracleText);
  });

  test('the 6/6 eats the 2/2 and wears 2', () => {
    const { g, mine, theirs } = pounced();
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[mine]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g } = pounced();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
