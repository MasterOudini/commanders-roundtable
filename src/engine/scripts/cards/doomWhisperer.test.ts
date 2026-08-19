// `Doom Whisperer` — the life-cost activation raising the surveil ask: 2
// life paid, the prompt up, the reject to the GRAVEYARD, repeatable.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DOOM_WHISPERER_SCRIPT } from './doomWhisperer';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function activated(): { g: Game; whisperer: InstanceId; revealed: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [['Doom Whisperer', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([DOOM_WHISPERER_SCRIPT]),
  });
  const whisperer = put(g, 'p1', 'Doom Whisperer');
  settle(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: whisperer, abilityIndex: 0 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  return { g, whisperer, revealed };
}

describe('Doom Whisperer', () => {
  test('pays 2 life, asks, and the reject goes to the GRAVEYARD', () => {
    const { g, revealed } = activated();
    expect(g.state.players['p1']?.life).toBe(38);
    expect(g.state.priority.awaiting?.kind === 'scryChoice' && g.state.priority.awaiting.toGraveyard).toBe(true);
    expect(revealed.length).toBe(2);
    const [a, b] = revealed as [InstanceId, InstanceId];
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [b], toBottom: [a] }));
    settle(g);
    expect(g.state.cards[a]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[b]?.zone.kind).toBe('library');
  });

  test('replays to the same hash', () => {
    const { g, revealed } = activated();
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [...revealed].reverse(), toBottom: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
