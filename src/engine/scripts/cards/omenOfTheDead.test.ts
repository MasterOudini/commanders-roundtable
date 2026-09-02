// `Omen of the Dead` — the entry aims a creature card in my graveyard back to
// my hand; the sacrifice scries 2.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { OMEN_OF_THE_DEAD_SCRIPT } from './omenOfTheDead';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const OMEN = 'Omen of the Dead';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(): { g: Game; omen: InstanceId; dead: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[OMEN, BEARS], []],
    scripts: createRegistry([OMEN_OF_THE_DEAD_SCRIPT]),
  });
  const dead = put(g, 'p1', BEARS, 'graveyard');
  settle(g);
  holdEverywhere(g);
  const omen = put(g, 'p1', OMEN);
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 60_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: dead }] }));
  settle(g);
  return { g, omen, dead };
}

describe('Omen of the Dead', () => {
  test('the entry returns the graveyard creature to my hand', () => {
    const { g, dead } = entered();
    expect(g.state.cards[dead]?.zone).toEqual({ kind: 'hand', player: 'p1' });
  });

  test('{2}{B}, sacrifice: scry 2, a bottomed card stays in the library', () => {
    const { g, omen } = entered();
    advanceUntil(g, (s) => s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: omen, abilityIndex: 0, targets: [] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
    expect(g.state.priority.awaiting?.kind === 'scryChoice' && !g.state.priority.awaiting.toGraveyard).toBe(true);
    const lib = g.state.zones.library['p1'] ?? [];
    const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
    expect(revealed.length).toBe(2);
    const [a, b] = revealed as [InstanceId, InstanceId];
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [b], toBottom: [a] }));
    settle(g);
    expect(g.state.cards[a]?.zone.kind).toBe('library');
    expect(g.state.cards[omen]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = entered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
