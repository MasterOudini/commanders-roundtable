// `Misty Palms Oasis` — enters tapped (built-in), then the sacrifice-draw.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { MISTY_PALMS_OASIS_SCRIPT } from './mistyPalmsOasis';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function oasised(): { g: Game; oasis: InstanceId; enteredTapped: boolean } {
  const g = startedGame({
    players: 2,
    decks: [['Misty Palms Oasis'], []],
    scripts: createRegistry([MISTY_PALMS_OASIS_SCRIPT]),
  });
  const oasis = put(g, 'p1', 'Misty Palms Oasis');
  settle(g);
  // Captured BEFORE any untap step touches it (the Kishla ordering trap).
  const enteredTapped = g.state.cards[oasis]?.tapped === true;
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [oasis], tapped: false }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
  return { g, oasis, enteredTapped };
}

describe('Misty Palms Oasis', () => {
  test('enters tapped; the sacrifice-draw pays and draws', () => {
    const { g, oasis, enteredTapped } = oasised();
    expect(enteredTapped).toBe(true);
    const mid = (g.state.zones.hand['p1'] ?? []).length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: oasis, abilityIndex: 1 }));
    settle(g);
    expect(g.state.cards[oasis]?.zone.kind).toBe('graveyard');
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mid + 1);
  });

  test('replays to the same hash', () => {
    const { g, oasis } = oasised();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: oasis, abilityIndex: 1 }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
