// `Suffocating Blast` — one resolve counters a REAL held cast AND burns a
// creature.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SUFFOCATING_BLAST_SCRIPT } from './suffocatingBlast';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function blasted(): { g: Game; held: InstanceId; victim: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Suffocating Blast'], ['Grizzly Bears', 'Grizzly Bears']],
    scripts: createRegistry([SUFFOCATING_BLAST_SCRIPT]),
  });
  holdEverywhere(g);
  const victim = put(g, 'p2', 'Grizzly Bears');
  const held = put(g, 'p2', 'Grizzly Bears', 'hand');
  settle(g);
  advanceUntil(
    g,
    (s) =>
      s.turn.turnNumber >= 4 &&
      s.turn.activePlayer === 'p2' &&
      s.priority.player === 'p2' &&
      s.priority.awaiting === null &&
      (s.turn.phase === 'precombatMain' || s.turn.phase === 'postcombatMain'),
    20_000,
  );
  must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p2', card: held }));
  advanceUntil(
    g,
    (s) => s.stack.length === 1 && s.priority.player === 'p1' && s.priority.awaiting === null,
    20_000,
  );
  const stackId = g.state.stack[0]?.id as string;
  const blast = put(g, 'p1', 'Suffocating Blast', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 3 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: blast }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(
    g.submit({
      t: 'ChooseTargets',
      player: 'p1',
      targets: [
        { kind: 'stack', id: stackId },
        { kind: 'card', id: victim },
      ],
    }),
  );
  settle(g);
  return { g, held, victim };
}

describe('Suffocating Blast', () => {
  test('the held spell is countered and the creature dies', () => {
    const { g, held, victim } = blasted();
    expect(g.state.cards[held]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
    expect(g.log.some((e) => e.body.t === 'SpellCountered')).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g } = blasted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 5, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
