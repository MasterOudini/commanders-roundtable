// `Mudhole` — the target's graveyard lands leave for exile; the creature
// stays put.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { MUDHOLE_SCRIPT } from './mudhole';
import { MUDHOLE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function holed(): { g: Game; land: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Mudhole'], ['Mountain', 'Grizzly Bears']],
    scripts: createRegistry([MUDHOLE_SCRIPT]),
  });
  const land = put(g, 'p2', 'Mountain');
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  must(
    g.submit({
      t: 'ManualMoveCard',
      player: 'p2',
      card: land,
      to: { kind: 'graveyard', player: 'p2' },
    }),
  );
  must(
    g.submit({
      t: 'ManualMoveCard',
      player: 'p2',
      card: bears,
      to: { kind: 'graveyard', player: 'p2' },
    }),
  );
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Mudhole', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(
    g.submit({
      t: 'CastSpell',
      player: 'p1',
      card: spell,
      targets: [{ kind: 'player', id: 'p2' }],
    }),
  );
  settle(g);
  return { g, land, bears };
}

describe('Mudhole', () => {
  test('the graveyard land is exiled; the creature card stays', () => {
    const { g, land, bears } = holed();
    expect(g.state.cards[land]?.zone.kind).toBe('exile');
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = MUDHOLE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, MUDHOLE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(MUDHOLE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = holed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
