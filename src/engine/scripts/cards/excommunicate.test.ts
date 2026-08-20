// `Excommunicate` — the creature sits on TOP of its owner's library.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { EXCOMMUNICATE_SCRIPT } from './excommunicate';
import { EXCOMMUNICATE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function excommunicated(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Excommunicate'], ['Grizzly Bears']],
    scripts: createRegistry([EXCOMMUNICATE_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Excommunicate', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Excommunicate', () => {
  test('the creature sits on TOP of its owner\'s library', () => {
    const { g, bears } = excommunicated();
    expect(g.state.cards[bears]?.zone.kind).toBe('library');
    const lib = g.state.zones.library['p2'] ?? [];
    expect(lib[lib.length - 1]).toBe(bears);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = EXCOMMUNICATE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, EXCOMMUNICATE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(EXCOMMUNICATE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = excommunicated();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
