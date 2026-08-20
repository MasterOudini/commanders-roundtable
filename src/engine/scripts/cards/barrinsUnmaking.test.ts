// `Barrin's Unmaking` — the color-mode condition: on a white-heavy board a
// white permanent bounces and a green one stays, both from one board.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { BARRINS_UNMAKING_SCRIPT } from './barrinsUnmaking';
import { BARRIN_S_UNMAKING } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

// Two WHITE bodies against one GREEN: white is the sole mode color.
function board(): { g: Game; white: InstanceId; green: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [["Barrin's Unmaking", 'Grizzly Bears'], ['Attentive Sunscribe', 'Angelheart Protector']],
    scripts: createRegistry([BARRINS_UNMAKING_SCRIPT]),
  });
  put(g, 'p2', 'Attentive Sunscribe');
  const white = put(g, 'p2', 'Angelheart Protector');
  const green = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  return { g, white, green };
}

function cast(g: Game, target: InstanceId): void {
  const spell = put(g, 'p1', "Barrin's Unmaking", 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: target }] }));
  settle(g);
}

describe("Barrin's Unmaking", () => {
  test('a permanent SHARING the mode color bounces', () => {
    const { g, white } = board();
    cast(g, white);
    expect(g.state.cards[white]?.zone.kind).toBe('hand');
  });

  test('a permanent OUTSIDE the mode color stays — the condition is real', () => {
    const { g, green } = board();
    cast(g, green);
    expect(g.state.cards[green]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = BARRIN_S_UNMAKING.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, BARRIN_S_UNMAKING.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(BARRIN_S_UNMAKING.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g, white } = board();
    cast(g, white);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
