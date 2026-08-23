// `Vibrant Outburst` — THE FIRST UP-TO-N CARD. Two answers are legal: both
// targets, or the damage alone. Both are proven here.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { VIBRANT_OUTBURST_SCRIPT } from './vibrantOutburst';
import { VIBRANT_OUTBURST } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { parseTargetClauses } from '../../../data/targetParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';
import type { TargetChoice } from '../../types/state';

const SPELL = 'Vibrant Outburst';
const VICTIM = 'Grave Titan'; // 6/6 — survives 3, so the tap is separable
const SECOND = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(picks: (ids: { titan: InstanceId; bears: InstanceId }) => TargetChoice[]): {
  g: Game;
  titan: InstanceId;
  bears: InstanceId;
} {
  const g = startedGame({
    players: 2,
    decks: [[SPELL], [VICTIM, SECOND]],
    scripts: createRegistry([VIBRANT_OUTBURST_SCRIPT]),
  });
  const titan = put(g, 'p2', VICTIM);
  const bears = put(g, 'p2', SECOND);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 4 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: picks({ titan, bears }) }));
  settle(g);
  return { g, titan, bears };
}

describe('Vibrant Outburst', () => {
  test('"up to one" parses as min 0 / max 1 beside the any-target', () => {
    const specs = parseTargetClauses(VIBRANT_OUTBURST.faces[0]?.oracleText ?? '');
    expect(specs).toHaveLength(2);
    expect(specs[1]?.min).toBe(0);
    expect(specs[1]?.max).toBe(1);
  });

  test('both halves: 3 damage and the tap', () => {
    const { g, titan, bears } = cast(({ titan: t, bears: b }) => [
      { kind: 'card', id: t },
      { kind: 'card', id: b },
    ]);
    expect(g.state.cards[titan]?.damage).toBe(3);
    expect(g.state.cards[bears]?.tapped).toBe(true);
  });

  test('the tap may be DECLINED — the damage still lands', () => {
    const { g, titan, bears } = cast(({ titan: t }) => [{ kind: 'card', id: t }]);
    expect(g.state.cards[titan]?.damage).toBe(3);
    expect(g.state.cards[bears]?.tapped).toBe(false);
  });

  test('the damage half reaches a PLAYER', () => {
    const { g } = cast(() => [{ kind: 'player', id: 'p2' }]);
    expect(g.state.players['p2']?.life).toBe(37);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = VIBRANT_OUTBURST.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, VIBRANT_OUTBURST.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(VIBRANT_OUTBURST.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cast(({ titan: t, bears: b }) => [
      { kind: 'card', id: t },
      { kind: 'card', id: b },
    ]);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
