// `Seer's Lantern` — {2}, {T} scries behind the mana line at #a1.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SEERS_LANTERN_SCRIPT } from './seersLantern';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function lanterned(): { g: Game; revealed: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [["Seer's Lantern"], []],
    scripts: createRegistry([SEERS_LANTERN_SCRIPT]),
  });
  const lantern = put(g, 'p1', "Seer's Lantern");
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: lantern, abilityIndex: 1 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  return { g, revealed };
}

describe("Seer's Lantern", () => {
  test('the paid scry asks (toGraveyard false)', () => {
    const { g, revealed } = lanterned();
    const awaiting = g.state.priority.awaiting;
    expect(awaiting?.kind).toBe('scryChoice');
    expect(awaiting?.kind === 'scryChoice' && awaiting.toGraveyard).toBe(false);
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    advanceUntil(g, (s) => (s.priority.awaiting ?? null) === null, 20_000);
  });

  test('replays to the same hash', () => {
    const { g, revealed } = lanterned();
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
