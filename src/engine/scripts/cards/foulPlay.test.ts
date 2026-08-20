// `Foul Play` — the 2-power creature dies and the CASTER gets the Clue;
// the aim refuses a 6/6 (D139's ceiling).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { FOUL_PLAY_SCRIPT } from './foulPlay';
import { FOUL_PLAY } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function played(): { g: Game; bears: InstanceId; maw: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Foul Play'], ['Grizzly Bears', 'Colossal Dreadmaw']],
    scripts: createRegistry([FOUL_PLAY_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  const maw = put(g, 'p2', 'Colossal Dreadmaw');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Foul Play', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  const reject = g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: maw }] });
  expect(reject.ok).toBe(false);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears, maw };
}

function cluesOf(g: Game, player: 'p1' | 'p2'): number {
  let n = 0;
  for (const id of g.state.zones.battlefield) {
    const card = g.state.cards[id];
    if (!card || card.controller !== player || !card.isToken) continue;
    if (g.deps.oracle.byPrinting(card.printingId)?.name === 'Clue') n++;
  }
  return n;
}

describe('Foul Play', () => {
  test('the 6/6 is REFUSED at the aim; the 2/2 dies and the CASTER gets the Clue', () => {
    const { g, bears } = played();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(cluesOf(g, 'p1')).toBe(1);
    expect(cluesOf(g, 'p2')).toBe(0);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = FOUL_PLAY.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, FOUL_PLAY.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(FOUL_PLAY.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = played();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
