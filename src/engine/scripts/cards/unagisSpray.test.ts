// `Unagi's Spray` — the debuff always lands; the DRAW is gated on the
// six-subtype census, proven from both sides with the Coral Eel.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { UNAGIS_SPRAY_SCRIPT } from './unagisSpray';
import { UNAGI_S_SPRAY } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = "Unagi's Spray";
const FISH = 'Coral Eel'; // Creature — Fish, vanilla
const BEARS = 'Grizzly Bears';
const TITAN = 'Grave Titan';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function drawn(g: Game, since: number): number {
  let n = 0;
  for (let i = since; i < g.log.length; i++) {
    const body = g.log[i]?.body;
    if (body?.t === 'DrewCards' && body.player === 'p1') n += body.cards.length;
  }
  return n;
}

function sprayed(withFish: boolean): { g: Game; victim: InstanceId; drew: number } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL, FISH, BEARS], [TITAN]],
    scripts: createRegistry([UNAGIS_SPRAY_SCRIPT]),
  });
  put(g, 'p1', withFish ? FISH : BEARS);
  const victim = put(g, 'p2', TITAN);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  const since = g.log.length;
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: victim }] }));
  settle(g);
  return { g, victim, drew: drawn(g, since) };
}

describe("Unagi's Spray", () => {
  test('with a FISH out: -4/-0 and a card', () => {
    const { g, victim, drew } = sprayed(true);
    expect(derive(g.state, ORACLE, g.deps.scripts, victim).power).toBe(2);
    expect(derive(g.state, ORACLE, g.deps.scripts, victim).toughness).toBe(6);
    expect(drew).toBe(1);
  });

  test('without one: the debuff still lands and NOTHING is drawn', () => {
    const { g, victim, drew } = sprayed(false);
    expect(derive(g.state, ORACLE, g.deps.scripts, victim).power).toBe(2);
    expect(drew).toBe(0);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = UNAGI_S_SPRAY.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, UNAGI_S_SPRAY.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(UNAGI_S_SPRAY.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = sprayed(true);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
