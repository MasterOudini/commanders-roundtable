// `Violent Ultimatum` — "three target permanents" parses min 3 / max 3. The
// counted-list machinery is now proven at 2 (D209), 3 (here) and 6 (D217).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { VIOLENT_ULTIMATUM_SCRIPT } from './violentUltimatum';
import { VIOLENT_ULTIMATUM } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { parseTargetClauses } from '../../../data/targetParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Violent Ultimatum';
const BEARS = 'Grizzly Bears';
const RING = 'Sol Ring';
const ISLAND = 'Island';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(): { g: Game; victims: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL], [BEARS, RING, ISLAND]],
    scripts: createRegistry([VIOLENT_ULTIMATUM_SCRIPT]),
  });
  const victims = [put(g, 'p2', BEARS), put(g, 'p2', RING), put(g, 'p2', ISLAND)];
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  for (const symbol of ['B', 'R', 'G'] as const) {
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol, amount: 4 }));
  }
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(
    g.submit({
      t: 'ChooseTargets',
      player: 'p1',
      targets: victims.map((id) => ({ kind: 'card', id }) as const),
    }),
  );
  settle(g);
  return { g, victims };
}

describe('Violent Ultimatum', () => {
  test('"three target permanents" parses min 3 / max 3', () => {
    const specs = parseTargetClauses(VIOLENT_ULTIMATUM.faces[0]?.oracleText ?? '');
    expect(specs).toHaveLength(1);
    expect(specs[0]?.min).toBe(3);
    expect(specs[0]?.max).toBe(3);
  });

  test('all three permanents die — creature, artifact and land alike', () => {
    const { g, victims } = cast();
    for (const id of victims) expect(g.state.cards[id]?.zone.kind).toBe('graveyard');
  });

  test('TWO targets is not a legal answer', () => {
    const g = startedGame({
      players: 2,
      decks: [[SPELL], [BEARS, RING, ISLAND]],
      scripts: createRegistry([VIOLENT_ULTIMATUM_SCRIPT]),
    });
    const a = put(g, 'p2', BEARS);
    const b = put(g, 'p2', RING);
    settle(g);
    holdEverywhere(g);
    advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
    const spell = put(g, 'p1', SPELL, 'hand');
    for (const symbol of ['B', 'R', 'G'] as const) {
      must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol, amount: 4 }));
    }
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    const res = g.submit({
      t: 'ChooseTargets',
      player: 'p1',
      targets: [
        { kind: 'card', id: a },
        { kind: 'card', id: b },
      ],
    });
    expect(res.ok).toBe(false);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = VIOLENT_ULTIMATUM.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, VIOLENT_ULTIMATUM.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(VIOLENT_ULTIMATUM.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cast();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
