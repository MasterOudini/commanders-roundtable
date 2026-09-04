// `Titania, Protector of Argoth` - entering returns a land card from the graveyard
// to the battlefield (a creature card refused); a land of hers dying makes an
// Elemental token; replay equal.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { TITANIA_PROTECTOR_OF_ARGOTH_SCRIPT } from './titaniaProtectorOfArgoth';
import { TOKEN_TABLE } from '../../../data/tokenTable';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = 'Titania, Protector of Argoth';
const FOREST = 'Forest';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(): { g: Game; forest: InstanceId; bears: InstanceId } {
  const g = startedGame({ players: 2, decks: [[CARD, FOREST, BEARS], [BEARS]], scripts: createRegistry([TITANIA_PROTECTOR_OF_ARGOTH_SCRIPT]) });
  holdEverywhere(g);
  const self = put(g, 'p1', CARD, 'graveyard');
  const forest = put(g, 'p1', FOREST, 'graveyard');
  const bears = put(g, 'p1', BEARS, 'graveyard');
  settle(g);
  must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, forest, bears };
}

describe('Titania, Protector of Argoth', () => {
  test('entering returns the land card to the battlefield; a creature card is refused', () => {
    const { g, forest, bears } = entered();
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }).ok).toBe(false);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: forest }] }));
    settle(g);
    expect(g.state.cards[forest]?.zone.kind).toBe('battlefield');
  });

  test('a land of hers dying makes a 5/3 Elemental token', () => {
    const { g, forest } = entered();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: forest }] }));
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: forest, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    const tokens = Object.values(g.state.cards).filter((c) => c.isToken && c.zone.kind === 'battlefield' && c.controller === 'p1');
    expect(tokens).toHaveLength(1);
    expect(tokens[0]?.oracleId).toBe(TOKEN_TABLE['Elemental|5/3|G|Creature|']?.oracleId);
  });

  test('replays to the same hash', () => {
    const { g, forest } = entered();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: forest }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
