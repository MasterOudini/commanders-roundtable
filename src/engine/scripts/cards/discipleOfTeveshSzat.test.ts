// `Disciple of Tevesh Szat` — the tap shrinks a 6/6 to 5/5; the six-mana
// self-sacrifice takes it to 0/0 and it dies, the Disciple already spent.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DISCIPLE_OF_TEVESH_SZAT_SCRIPT } from './discipleOfTeveshSzat';
import { advanceUntil, deps, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const DISCIPLE = 'Disciple of Tevesh Szat';
const TITAN = 'Grave Titan'; // 6/6

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; disciple: InstanceId; titan: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[DISCIPLE], [TITAN]],
    scripts: createRegistry([DISCIPLE_OF_TEVESH_SZAT_SCRIPT]),
  });
  const titan = put(g, 'p2', TITAN);
  const disciple = put(g, 'p1', DISCIPLE);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3 && s.priority.awaiting === null, 60_000);
  return { g, disciple, titan };
}

function pt(g: Game, id: InstanceId): { power: number | null; toughness: number | null } {
  const d = deps(createRegistry([DISCIPLE_OF_TEVESH_SZAT_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return { power: got.power, toughness: got.toughness };
}

describe('Disciple of Tevesh Szat', () => {
  test('{T}: -1/-1', () => {
    const { g, disciple, titan } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: disciple, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: titan }] }));
    settle(g);
    expect(pt(g, titan)).toEqual({ power: 5, toughness: 5 });
    expect(g.state.cards[disciple]?.tapped).toBe(true);
  });

  test('{4}{B}{B}, {T}, sacrifice: -6/-6 kills the 6/6, the Disciple is spent', () => {
    const { g, disciple, titan } = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 2 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: disciple, abilityIndex: 1 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: titan }] }));
    settle(g);
    expect(g.state.cards[titan]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[disciple]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, disciple, titan } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: disciple, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: titan }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
