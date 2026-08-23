// `Villainous Wrath` — the COUNT is taken before the wipe, so the opponent
// pays for the creatures the wipe is about to take. Plain bodies only: no
// entry trigger may add to the count behind the assertion.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { VILLAINOUS_WRATH_SCRIPT } from './villainousWrath';
import { VILLAINOUS_WRATH } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Villainous Wrath';
const BEARS = 'Grizzly Bears';
const ELVES = 'Llanowar Elves';
const MINE = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(): { g: Game; theirs: InstanceId[]; mine: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL, MINE], [BEARS, ELVES]],
    scripts: createRegistry([VILLAINOUS_WRATH_SCRIPT]),
  });
  const a = put(g, 'p2', BEARS);
  const b = put(g, 'p2', ELVES);
  const mine = put(g, 'p1', MINE);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 9 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return { g, theirs: [a, b], mine };
}

describe('Villainous Wrath', () => {
  test('the opponent pays one life per creature THEY controlled', () => {
    const { g } = cast();
    expect(g.state.players['p2']?.life).toBe(38);
  });

  test('then EVERY creature dies, mine included', () => {
    const { g, theirs, mine } = cast();
    for (const id of theirs) expect(g.state.cards[id]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[mine]?.zone.kind).toBe('graveyard');
  });

  test('my own life is untouched — the loss is the OPPONENT’s', () => {
    const { g } = cast();
    expect(g.state.players['p1']?.life).toBe(40);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = VILLAINOUS_WRATH.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, VILLAINOUS_WRATH.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(VILLAINOUS_WRATH.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cast();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
