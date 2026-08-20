// `Homing Lightning` — the name fan crosses the whole battlefield: both
// other Bears burn with the target, whoever controls them; the Herder is
// untouched.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { HOMING_LIGHTNING_SCRIPT } from './homingLightning';
import { HOMING_LIGHTNING } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function struck(): { g: Game; mine: InstanceId; a: InstanceId; b: InstanceId; herder: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Homing Lightning', 'Grizzly Bears'],
      ['Grizzly Bears', 'Grizzly Bears', 'Elvish Herder'],
    ],
    scripts: createRegistry([HOMING_LIGHTNING_SCRIPT]),
  });
  const mine = put(g, 'p1', 'Grizzly Bears');
  const a = put(g, 'p2', 'Grizzly Bears');
  const b = put(g, 'p2', 'Grizzly Bears');
  expect(b).not.toBe(a);
  const herder = put(g, 'p2', 'Elvish Herder');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Homing Lightning', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: a }] }));
  settle(g);
  return { g, mine, a, b, herder };
}

describe('Homing Lightning', () => {
  test('the target and EVERY other same-name creature die — my own Bears included', () => {
    const { g, mine, a, b, herder } = struck();
    expect(g.state.cards[a]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[b]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[mine]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[herder]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[herder]?.damage).toBe(0);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = HOMING_LIGHTNING.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, HOMING_LIGHTNING.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(HOMING_LIGHTNING.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = struck();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
