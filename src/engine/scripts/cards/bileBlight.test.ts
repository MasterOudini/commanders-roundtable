// `Bile Blight` — the NAME predicate on a debuff: both same-name Bears die
// of one cast, the differently named 6/6 is untouched.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { BILE_BLIGHT_SCRIPT } from './bileBlight';
import { BILE_BLIGHT } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function blighted(): { g: Game; a: InstanceId; b: InstanceId; maw: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Bile Blight'], ['Grizzly Bears', 'Grizzly Bears', 'Colossal Dreadmaw']],
    scripts: createRegistry([BILE_BLIGHT_SCRIPT]),
  });
  const a = put(g, 'p2', 'Grizzly Bears');
  const b = put(g, 'p2', 'Grizzly Bears');
  const maw = put(g, 'p2', 'Colossal Dreadmaw');
  expect(b).not.toBe(a);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Bile Blight', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: a }] }));
  settle(g);
  return { g, a, b, maw };
}

describe('Bile Blight', () => {
  test('BOTH same-name creatures die; the different name is untouched', () => {
    const { g, a, b, maw } = blighted();
    expect(g.state.cards[a]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[b]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[maw]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = BILE_BLIGHT.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, BILE_BLIGHT.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(BILE_BLIGHT.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = blighted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
