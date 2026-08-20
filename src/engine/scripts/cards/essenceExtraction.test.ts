// `Essence Extraction` — 3 kills the 2/2 and the caster gains 3.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { ESSENCE_EXTRACTION_SCRIPT } from './essenceExtraction';
import { ESSENCE_EXTRACTION } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function extracted(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Essence Extraction'], ['Grizzly Bears']],
    scripts: createRegistry([ESSENCE_EXTRACTION_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Essence Extraction', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Essence Extraction', () => {
  test('3 kills the 2/2; the caster gains 3', () => {
    const { g, bears } = extracted();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p1']?.life).toBe(43);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = ESSENCE_EXTRACTION.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, ESSENCE_EXTRACTION.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(ESSENCE_EXTRACTION.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = extracted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
