// `Veteran's Reflexes` — +1/+1 AND an untap, with an already-upright target
// getting the pump and no untap event.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { VETERANS_REFLEXES_SCRIPT } from './veteransReflexes';
import { VETERAN_S_REFLEXES } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = "Veteran's Reflexes";
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(tapped: boolean): { g: Game; bears: InstanceId; untaps: number } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL, BEARS], []],
    scripts: createRegistry([VETERANS_REFLEXES_SCRIPT]),
  });
  const bears = put(g, 'p1', BEARS);
  settle(g);
  if (tapped) {
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [bears], tapped: true }));
    settle(g);
  }
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  const since = g.log.length;
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  let untaps = 0;
  for (let i = since; i < g.log.length; i++) {
    const body = g.log[i]?.body;
    if (body?.t === 'PermanentsUntapped' && body.cards.includes(bears)) untaps += 1;
  }
  return { g, bears, untaps };
}

describe("Veteran's Reflexes", () => {
  test('a TAPPED creature is pumped and straightened', () => {
    const { g, bears, untaps } = cast(true);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).power).toBe(3);
    expect(g.state.cards[bears]?.tapped).toBe(false);
    expect(untaps).toBe(1);
  });

  test('an UPRIGHT creature is pumped and no untap is emitted', () => {
    const { g, bears, untaps } = cast(false);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).power).toBe(3);
    expect(untaps).toBe(0);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = VETERAN_S_REFLEXES.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, VETERAN_S_REFLEXES.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(VETERAN_S_REFLEXES.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cast(true);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
