// `Blastfire Bolt` — 5 damage plus every ATTACHED Equipment destroyed: the
// Greaves on the target die, the unattached ones stand.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { BLASTFIRE_BOLT_SCRIPT } from './blastfireBolt';
import { BLASTFIRE_BOLT } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function bolted(): { g: Game; maw: InstanceId; worn: InstanceId; spare: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Blastfire Bolt'], ['Colossal Dreadmaw', 'Lightning Greaves', 'Lightning Greaves']],
    scripts: createRegistry([BLASTFIRE_BOLT_SCRIPT]),
  });
  const maw = put(g, 'p2', 'Colossal Dreadmaw');
  const worn = put(g, 'p2', 'Lightning Greaves');
  const spare = put(g, 'p2', 'Lightning Greaves');
  expect(spare).not.toBe(worn);
  must(g.submit({ t: 'ManualAttach', player: 'p2', card: worn, to: maw }));
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Blastfire Bolt', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 6 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: maw }] }));
  settle(g);
  return { g, maw, worn, spare };
}

describe('Blastfire Bolt', () => {
  test('5 damage marked; the WORN Greaves die, the spare pair stands', () => {
    const { g, maw, worn, spare } = bolted();
    expect(g.state.cards[maw]?.damage).toBe(5);
    expect(g.state.cards[worn]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[spare]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = BLASTFIRE_BOLT.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, BLASTFIRE_BOLT.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(BLASTFIRE_BOLT.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = bolted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
