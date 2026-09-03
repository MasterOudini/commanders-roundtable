// `Roc Charger` — attacking alongside a Bears lets the trigger lift the
// Bears (attacking, no flying); a creature that stayed home is refused
// (the combat role, D291) and so is the attacking flyer (the keyword, D289).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ROC_CHARGER_SCRIPT } from './rocCharger';
import { advanceUntil, deps, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = 'Roc Charger';
const BEARS = 'Grizzly Bears';
const HAWK = 'Vampire Nighthawk';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function attacked(): { g: Game; bears: InstanceId; home: InstanceId; hawk: InstanceId } {
  const g = startedGame({ players: 2, decks: [[CARD, BEARS, BEARS, HAWK], []], scripts: createRegistry([ROC_CHARGER_SCRIPT]) });
  const charger = put(g, 'p1', CARD);
  const bears = put(g, 'p1', BEARS);
  const home = put(g, 'p1', BEARS);
  const hawk = put(g, 'p1', HAWK);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers', 20_000);
  must(
    g.submit({
      t: 'DeclareAttackers',
      player: 'p1',
      attackers: [
        { card: charger, defender: { kind: 'player', id: 'p2' } },
        { card: bears, defender: { kind: 'player', id: 'p2' } },
        { card: hawk, defender: { kind: 'player', id: 'p2' } },
      ],
    }),
  );
  expect(g.state.priority.awaiting?.kind).toBe('chooseTargets');
  return { g, bears, home, hawk };
}

describe('Roc Charger', () => {
  test('the attacking Bears gains flying until end of turn', () => {
    const { g, bears } = attacked();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    const d = deps(createRegistry([ROC_CHARGER_SCRIPT]));
    expect(derive(g.state, d.oracle, d.scripts, bears).keywords.has('flying')).toBe(true);
  });

  test('a creature that stayed home is refused (D291); the attacking flyer is refused (D289)', () => {
    const { g, home, hawk } = attacked();
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: home }] }).ok).toBe(false);
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: hawk }] }).ok).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, bears } = attacked();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
