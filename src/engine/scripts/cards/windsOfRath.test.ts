// `Winds of Rath` — an Aura is the only thing that saves a creature.
//
// ⚠️ The Aura is CAST, not hand-placed. Measured while writing this: an Aura
// dropped onto the battlefield by `put()` is unattached, so SBA bins it before
// any `ManualAttach` can land (zone 'graveyard' with `attachedTo` still set),
// and attaching-then-moving-it-back trips an invariant. Casting it is the
// game's own mechanism and the only one that leaves a legal attachment.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { WINDS_OF_RATH_SCRIPT } from './windsOfRath';
import { WINDS_OF_RATH } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Winds of Rath';
const BEARS = 'Grizzly Bears';
const AURA = 'Pacifism';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(): { g: Game; bare: InstanceId; enchanted: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      [SPELL, BEARS, BEARS, AURA],
      [BEARS],
    ],
    scripts: createRegistry([WINDS_OF_RATH_SCRIPT]),
  });
  const bare = put(g, 'p1', BEARS);
  const enchanted = put(g, 'p1', BEARS);
  const theirs = put(g, 'p2', BEARS);
  settle(g);

  // Cast the Aura onto `enchanted` — the game's own attach path.
  const aura = put(g, 'p1', AURA, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: aura }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: enchanted }] }));
  settle(g);
  expect(g.state.cards[aura]?.zone.kind).toBe('battlefield');
  expect(g.state.cards[aura]?.attachedTo).toBe(enchanted);

  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 8 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, bare, enchanted, theirs };
}

describe('Winds of Rath', () => {
  test('an ENCHANTED creature survives', () => {
    const { g, enchanted } = cast();
    expect(g.state.cards[enchanted]?.zone.kind).toBe('battlefield');
  });

  test('a bare creature dies, mine and theirs alike', () => {
    const { g, bare, theirs } = cast();
    expect(g.state.cards[bare]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = WINDS_OF_RATH.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, WINDS_OF_RATH.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(WINDS_OF_RATH.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cast();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
