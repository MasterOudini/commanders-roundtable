// `Morningtide` — every graveyard empties into exile.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { MORNINGTIDE_SCRIPT } from './morningtide';
import { MORNINGTIDE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function tided(): { g: Game; mine: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Morningtide', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([MORNINGTIDE_SCRIPT]),
  });
  const mine = put(g, 'p1', 'Grizzly Bears');
  const theirs = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  must(
    g.submit({
      t: 'ManualMoveCard',
      player: 'p1',
      card: mine,
      to: { kind: 'graveyard', player: 'p1' },
    }),
  );
  must(
    g.submit({
      t: 'ManualMoveCard',
      player: 'p2',
      card: theirs,
      to: { kind: 'graveyard', player: 'p2' },
    }),
  );
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Morningtide', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, mine, theirs };
}

describe('Morningtide', () => {
  test('both graveyards empty into exile', () => {
    const { g, mine, theirs } = tided();
    expect(g.state.cards[mine]?.zone.kind).toBe('exile');
    expect(g.state.cards[theirs]?.zone.kind).toBe('exile');
    expect((g.state.zones.graveyard['p2'] ?? []).length).toBe(0);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = MORNINGTIDE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, MORNINGTIDE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(MORNINGTIDE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = tided();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
