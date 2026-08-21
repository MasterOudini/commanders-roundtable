// `Spellkeeper Weird` — the self-sac graveyard return: an instant comes
// back, a creature card is refused at the aim.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SPELLKEEPER_WEIRD_SCRIPT } from './spellkeeperWeird';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function kept(): { g: Game; weird: InstanceId; bolt: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Spellkeeper Weird', 'Lightning Bolt', 'Grizzly Bears'], []],
    scripts: createRegistry([SPELLKEEPER_WEIRD_SCRIPT]),
  });
  const weird = put(g, 'p1', 'Spellkeeper Weird');
  const bolt = put(g, 'p1', 'Lightning Bolt', 'graveyard');
  const bears = put(g, 'p1', 'Grizzly Bears', 'graveyard');
  settle(g);
  holdEverywhere(g);
  advanceUntil(
    g,
    (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain' && s.turn.turnNumber >= 3,
    60_000,
  );
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 2 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: weird, abilityIndex: 0 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  const refused = g.submit({
    t: 'ChooseTargets',
    player: 'p1',
    targets: [{ kind: 'card', id: bears }],
  });
  if (refused.ok) throw new Error('a creature card must be refused — instant or sorcery');
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bolt }] }));
  settle(g);
  return { g, weird, bolt };
}

describe('Spellkeeper Weird', () => {
  test('the Weird pays itself and the Bolt comes to hand', () => {
    const { g, weird, bolt } = kept();
    expect(g.state.cards[weird]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[bolt]?.zone).toEqual({ kind: 'hand', player: 'p1' });
  });

  test('replays to the same hash', () => {
    const { g } = kept();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
