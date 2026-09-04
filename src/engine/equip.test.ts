// D305 - THE EQUIPMENT SEAM, the engine half: Lightning Greaves (no script)
// equips your creature through the synthesized ability, moves when equipped
// again, is refused at instant speed and on the opponent's creature, stays on
// the battlefield unattached when the host dies (CR 704.5n), and replays.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registry';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const GREAVES = 'Lightning Greaves';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; greaves: InstanceId; bears: InstanceId; eel: InstanceId; other: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[GREAVES, 'Grizzly Bears', 'Coral Eel'], ['Cyclops of One-Eyed Pass']],
    scripts: createRegistry([]),
  });
  holdEverywhere(g);
  const greaves = put(g, 'p1', GREAVES);
  const bears = put(g, 'p1', 'Grizzly Bears');
  const eel = put(g, 'p1', 'Coral Eel');
  const other = put(g, 'p2', 'Cyclops of One-Eyed Pass');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  return { g, greaves, bears, eel, other };
}

describe('Equip resolves natively (D305)', () => {
  test('Equip {0} attaches the Equipment to your creature', () => {
    const { g, greaves, bears } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: greaves, abilityIndex: 0, targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[greaves]?.attachedTo).toBe(bears);
    expect(g.state.cards[bears]?.attachments).toContain(greaves);
  });

  test('equipping again moves it', () => {
    const { g, greaves, bears, eel } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: greaves, abilityIndex: 0, targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: greaves, abilityIndex: 0, targets: [{ kind: 'card', id: eel }] }));
    settle(g);
    expect(g.state.cards[greaves]?.attachedTo).toBe(eel);
    expect(g.state.cards[bears]?.attachments).not.toContain(greaves);
  });

  test('the opponent creature is no legal host', () => {
    const { g, greaves, other } = board();
    expect(g.submit({ t: 'ActivateAbility', player: 'p1', card: greaves, abilityIndex: 0, targets: [{ kind: 'card', id: other }] }).ok).toBe(false);
  });

  test('sorcery speed: refused on the opponent turn', () => {
    const { g, greaves, bears } = board();
    advanceUntil(g, (s) => s.turn.turnNumber === 4 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
    expect(g.submit({ t: 'ActivateAbility', player: 'p1', card: greaves, abilityIndex: 0, targets: [{ kind: 'card', id: bears }] }).ok).toBe(false);
  });

  test('the host dying leaves the Equipment on the battlefield, unattached (CR 704.5n)', () => {
    const { g, greaves, bears } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: greaves, abilityIndex: 0, targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: bears, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(g.state.cards[greaves]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[greaves]?.attachedTo).toBeNull();
  });

  test('replays to the same hash', () => {
    const { g, greaves, bears } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: greaves, abilityIndex: 0, targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
