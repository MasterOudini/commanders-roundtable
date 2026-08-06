// `Agent of Shauku` — THE STAGED CHAIN, proven end to end (D169): the
// activation names its sacrifice, the engine raises the target prompt, and
// the COST IS CHARGED ON THE ANSWER — CR 601.2's order (targets at 601.2c,
// payment at 601.2g) made visible: the land is still on the battlefield
// while the prompt is up.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { AGENT_OF_SHAUKU_SCRIPT } from './agentOfShauku';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const AGENT = 'Agent of Shauku';
const FOUNTAIN = 'Radiant Fountain';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; agent: InstanceId; fountain: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[AGENT, FOUNTAIN, BEARS], []],
    scripts: createRegistry([AGENT_OF_SHAUKU_SCRIPT]),
  });
  const agent = put(g, 'p1', AGENT);
  const fountain = put(g, 'p1', FOUNTAIN);
  const bears = put(g, 'p1', BEARS);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  return { g, agent, fountain, bears };
}

describe('Agent of Shauku', () => {
  test('the chain: pick rides the intent, targets are STAGED, the cost waits for the answer', () => {
    const { g, agent, fountain, bears } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: agent, abilityIndex: 0, sacrifice: fountain }));
    // The prompt is up and NOTHING has been paid yet — CR 601.2c before 601.2g.
    expect(g.state.priority.awaiting?.kind).toBe('chooseTargets');
    expect(g.state.cards[fountain]?.zone.kind).toBe('battlefield');
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    // The answer pays: the land is gone before the ability resolves.
    expect(g.state.cards[fountain]?.zone.kind).toBe('graveyard');
    settle(g);
    expect(
      g.log.some(
        (e) => e.body.t === 'PtModifiedUntilEndOfTurn' && e.body.card === bears && e.body.power === 2,
      ),
    ).toBe(true);
  });

  test('a MISSING pick is refused on the staged path too, with nothing eaten', () => {
    const { g, agent, fountain } = game();
    const r = g.submit({ t: 'ActivateAbility', player: 'p1', card: agent, abilityIndex: 0 });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toBe('needsSacrifice');
    expect(g.state.cards[fountain]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g, agent, fountain, bears } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: agent, abilityIndex: 0, sacrifice: fountain }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
