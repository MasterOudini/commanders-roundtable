// `Ominous Asylum` — the ACTIVATED surveil: the land pays no sacrifice and
// survives its own ability.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { OMINOUS_ASYLUM_SCRIPT } from './ominousAsylum';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function asylumed(): { g: Game; asylum: InstanceId; revealed: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [['Ominous Asylum'], []],
    scripts: createRegistry([OMINOUS_ASYLUM_SCRIPT]),
  });
  const asylum = put(g, 'p1', 'Ominous Asylum');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [asylum], tapped: false }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: asylum, abilityIndex: 1 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  return { g, asylum, revealed };
}

describe('Ominous Asylum', () => {
  test('the surveil asks and the land SURVIVES — no sacrifice in the cost', () => {
    const { g, asylum, revealed } = asylumed();
    const awaiting = g.state.priority.awaiting;
    expect(awaiting?.kind).toBe('scryChoice');
    expect(awaiting?.kind === 'scryChoice' && awaiting.toGraveyard).toBe(true);
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: revealed }));
    settle(g);
    expect(g.state.cards[asylum]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[asylum]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, revealed } = asylumed();
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
