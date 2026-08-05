// `Briarknit Kami` — a SPIRIT spell asks for a counter target; a plain
// creature spell asks nothing. The subtype filter is the card.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { BRIARKNIT_KAMI_SCRIPT } from './briarknitKami';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const KAMI = 'Briarknit Kami';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; kami: InstanceId } {
  const g = startedGame({
    players: 2,
    // Bile Urchin is the fixture pool's cheapest SPIRIT spell.
    decks: [[KAMI, 'Bile Urchin', 'Grizzly Bears'], []],
    scripts: createRegistry([BRIARKNIT_KAMI_SCRIPT]),
  });
  const kami = put(g, 'p1', KAMI);
  settle(g);
  return { g, kami };
}

describe('Briarknit Kami', () => {
  test('casting a SPIRIT spell puts the counter on the chosen creature', () => {
    const { g, kami } = game();
    const urchin = put(g, 'p1', 'Bile Urchin', 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: urchin, targets: [] }));
    expect(g.state.priority.awaiting?.kind).toBe('chooseTargets');
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: kami }] }));
    settle(g);
    expect(g.state.cards[kami]?.counters['+1/+1']).toBe(1);
  });

  test('a NON-Spirit creature spell triggers nothing', () => {
    const { g } = game();
    const bears = put(g, 'p1', 'Grizzly Bears', 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 2 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bears, targets: [] }));
    settle(g);
    expect(g.log.some((e) => e.body.t === 'CountersChanged')).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, kami } = game();
    const urchin = put(g, 'p1', 'Bile Urchin', 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: urchin, targets: [] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: kami }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
