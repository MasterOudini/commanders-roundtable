// `Unlicensed Disintegration` — the destroy always; the 3 damage only behind
// an artifact of mine.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { UNLICENSED_DISINTEGRATION_SCRIPT } from './unlicensedDisintegration';
import { UNLICENSED_DISINTEGRATION } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Unlicensed Disintegration';
const BEARS = 'Grizzly Bears';
const RING = 'Sol Ring';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function fired(withArtifact: boolean): { g: Game; victim: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL, RING], [BEARS]],
    scripts: createRegistry([UNLICENSED_DISINTEGRATION_SCRIPT]),
  });
  if (withArtifact) put(g, 'p1', RING);
  const victim = put(g, 'p2', BEARS);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: victim }] }));
  settle(g);
  return { g, victim };
}

describe('Unlicensed Disintegration', () => {
  test('with an artifact: the creature dies and its controller takes 3', () => {
    const { g, victim } = fired(true);
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
    expect(g.state.players.p2?.life).toBe(37);
  });

  test('without one: the creature still dies and NOBODY takes damage', () => {
    const { g, victim } = fired(false);
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
    expect(g.state.players.p2?.life).toBe(40);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = UNLICENSED_DISINTEGRATION.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, UNLICENSED_DISINTEGRATION.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(UNLICENSED_DISINTEGRATION.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = fired(true);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
