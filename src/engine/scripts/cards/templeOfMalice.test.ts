// `Temple of Malice` — the first SCRY TRIGGER, and both halves of the land:
// it arrives TAPPED (D134's built-in) and the trigger raises the D195
// prompt, answered exactly as a spell's would be.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { TEMPLE_OF_MALICE_SCRIPT } from './templeOfMalice';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function played(): { g: Game; temple: InstanceId; revealed: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Temple of Malice', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([TEMPLE_OF_MALICE_SCRIPT]),
  });
  const temple = put(g, 'p1', 'Temple of Malice');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'))[0] as InstanceId;
  return { g, temple, revealed };
}

describe('Temple of Malice', () => {
  test('enters TAPPED and the trigger raises the scry prompt', () => {
    const { g, temple } = played();
    expect(g.state.cards[temple]?.tapped).toBe(true);
    expect(g.state.priority.awaiting?.kind).toBe('scryChoice');
  });

  test('bottoming the card puts it at index 0 and the prompt clears', () => {
    const { g, revealed } = played();
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: [revealed] }));
    settle(g);
    expect(g.state.zones.library['p1']?.[0]).toBe(revealed);
    expect(g.state.priority.awaiting).toBeNull();
  });

  test('replays to the same hash', () => {
    const { g, revealed } = played();
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [revealed], toBottom: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
