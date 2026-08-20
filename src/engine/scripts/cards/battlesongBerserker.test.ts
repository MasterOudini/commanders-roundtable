// `Battlesong Berserker` — "whenever you attack" is MY declaration: the
// trigger asks for a target mid-combat and the grant lands; the OPPONENT's
// attack pays nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { BATTLESONG_BERSERKER_SCRIPT } from './battlesongBerserker';
import { derive } from '../../derive';
import { ORACLE, advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function attacked(): { g: Game; berserker: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Battlesong Berserker'], ['Grizzly Bears']],
    scripts: createRegistry([BATTLESONG_BERSERKER_SCRIPT]),
  });
  const berserker = put(g, 'p1', 'Battlesong Berserker');
  settle(g);
  advanceUntil(
    g,
    (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers',
    60_000,
  );
  must(
    g.submit({
      t: 'DeclareAttackers',
      player: 'p1',
      attackers: [{ card: berserker, defender: { kind: 'player', id: 'p2' } }],
    }),
  );
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: berserker }] }));
  settle(g);
  return { g, berserker };
}

describe('Battlesong Berserker', () => {
  test('my attack grants +1/+0 and derived menace to the chosen creature', () => {
    const { g, berserker } = attacked();
    const d = derive(g.state, ORACLE, g.deps.scripts, berserker);
    expect(d.power).toBe(4);
    expect(d.keywords.has('menace')).toBe(true);
  });

  test("the OPPONENT's attack pays nothing", () => {
    const g = startedGame({
      players: 2,
      decks: [['Battlesong Berserker'], ['Grizzly Bears']],
      scripts: createRegistry([BATTLESONG_BERSERKER_SCRIPT]),
    });
    put(g, 'p1', 'Battlesong Berserker');
    const theirs = put(g, 'p2', 'Grizzly Bears');
    settle(g);
    advanceUntil(
      g,
      (s) => s.turn.activePlayer === 'p2' && s.priority.awaiting?.kind === 'declareAttackers',
      60_000,
    );
    must(
      g.submit({
        t: 'DeclareAttackers',
        player: 'p2',
        attackers: [{ card: theirs, defender: { kind: 'player', id: 'p1' } }],
      }),
    );
    settle(g);
    // No chooseTargets prompt was raised for p1's trigger — combat just runs.
    expect(g.state.pendingTriggers).toHaveLength(0);
  });

  test('replays to the same hash', () => {
    const { g } = attacked();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
