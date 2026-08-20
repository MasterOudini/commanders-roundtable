// `Nimraiser Paladin` — the entry returns a cheap creature card to hand;
// an expensive one is refused at the answer.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { NIMRAISER_PALADIN_SCRIPT } from './nimraiserPaladin';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function raised(): { g: Game; cheap: InstanceId; fat: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Nimraiser Paladin', 'Grizzly Bears', 'Grave Titan'], []],
    scripts: createRegistry([NIMRAISER_PALADIN_SCRIPT]),
  });
  const cheap = put(g, 'p1', 'Grizzly Bears');
  const fat = put(g, 'p1', 'Grave Titan');
  settle(g);
  for (const card of [cheap, fat]) {
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
  }
  settle(g);
  holdEverywhere(g);
  put(g, 'p1', 'Nimraiser Paladin');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 60_000);
  return { g, cheap, fat };
}

describe('Nimraiser Paladin', () => {
  test('the mv-2 Bears returns to hand; the mv-6 Titan is refused', () => {
    const { g, cheap, fat } = raised();
    const refused = g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: fat }] });
    expect(refused.ok).toBe(false);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: cheap }] }));
    settle(g);
    const card = g.state.cards[cheap];
    expect(card?.zone.kind).toBe('hand');
    expect(g.state.cards[fat]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, cheap } = raised();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: cheap }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
