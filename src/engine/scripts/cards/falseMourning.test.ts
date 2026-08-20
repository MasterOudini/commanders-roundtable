// `False Mourning` — the dead card comes back to the TOP of my library.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { FALSE_MOURNING_SCRIPT } from './falseMourning';
import { FALSE_MOURNING } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function mourned(): { g: Game; dead: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['False Mourning', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([FALSE_MOURNING_SCRIPT]),
  });
  const dead = put(g, 'p1', 'Grizzly Bears', 'graveyard');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'False Mourning', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: dead }] }));
  settle(g);
  return { g, dead };
}

describe('False Mourning', () => {
  test('the dead card comes back to the TOP of my library', () => {
    const { g, dead } = mourned();
    expect(g.state.cards[dead]?.zone.kind).toBe('library');
    const lib = g.state.zones.library['p1'] ?? [];
    expect(lib[lib.length - 1]).toBe(dead);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = FALSE_MOURNING.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, FALSE_MOURNING.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(FALSE_MOURNING.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = mourned();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
