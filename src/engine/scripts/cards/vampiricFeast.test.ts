// `Vampiric Feast` — 4 anywhere and a flat 4 gain.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { VAMPIRIC_FEAST_SCRIPT } from './vampiricFeast';
import { VAMPIRIC_FEAST } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Vampiric Feast';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function feasted(at: 'player' | 'creature'): { g: Game; victim: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL], [BEARS]],
    scripts: createRegistry([VAMPIRIC_FEAST_SCRIPT]),
  });
  const victim = put(g, 'p2', BEARS);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 7 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(
    g.submit({
      t: 'ChooseTargets',
      player: 'p1',
      targets: [at === 'player' ? { kind: 'player', id: 'p2' } : { kind: 'card', id: victim }],
    }),
  );
  settle(g);
  return { g, victim };
}

describe('Vampiric Feast', () => {
  test('at a player: 4 off them, 4 onto me', () => {
    const { g } = feasted('player');
    expect(g.state.players.p2?.life).toBe(36);
    expect(g.state.players.p1?.life).toBe(44);
  });

  test('at a creature: it dies and I still gain 4', () => {
    const { g, victim } = feasted('creature');
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
    expect(g.state.players.p1?.life).toBe(44);
    expect(g.state.players.p2?.life).toBe(40);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = VAMPIRIC_FEAST.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, VAMPIRIC_FEAST.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(VAMPIRIC_FEAST.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = feasted('player');
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
