// `Turn to Slag` — 5 damage AND the Equipment attached to that creature,
// with an Equipment on a DIFFERENT creature proving the attachment filter.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { TURN_TO_SLAG_SCRIPT } from './turnToSlag';
import { TURN_TO_SLAG } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Turn to Slag';
const VICTIM = 'Grizzly Bears'; // 2/2 — 5 damage kills it
const BYSTANDER = 'Air Elemental';
const BOOTS = 'Swiftfoot Boots';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function slagged(): {
  g: Game;
  victim: InstanceId;
  worn: InstanceId;
  elsewhere: InstanceId;
} {
  const g = startedGame({
    players: 2,
    decks: [[SPELL], [VICTIM, BYSTANDER, BOOTS, BOOTS]],
    scripts: createRegistry([TURN_TO_SLAG_SCRIPT]),
  });
  const victim = put(g, 'p2', VICTIM);
  const bystander = put(g, 'p2', BYSTANDER);
  const worn = put(g, 'p2', BOOTS);
  const elsewhere = put(g, 'p2', BOOTS);
  expect(worn).not.toBe(elsewhere);
  settle(g);
  must(g.submit({ t: 'ManualAttach', player: 'p2', card: worn, to: victim }));
  must(g.submit({ t: 'ManualAttach', player: 'p2', card: elsewhere, to: bystander }));
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 5 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: victim }] }));
  settle(g);
  return { g, victim, worn, elsewhere };
}

describe('Turn to Slag', () => {
  test('the creature dies and ONLY the Equipment it wore dies with it', () => {
    const { g, victim, worn, elsewhere } = slagged();
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[worn]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[elsewhere]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = TURN_TO_SLAG.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, TURN_TO_SLAG.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(TURN_TO_SLAG.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = slagged();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
