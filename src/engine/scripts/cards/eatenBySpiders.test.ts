// `Eaten by Spiders` — the flyer and the Greaves it wears die; the spare
// Greaves stand; a ground creature is refused at the aim.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { EATEN_BY_SPIDERS_SCRIPT } from './eatenBySpiders';
import { EATEN_BY_SPIDERS } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Eaten by Spiders';
const HAWK = 'Vampire Nighthawk';
const BEARS = 'Grizzly Bears';
const GREAVES = 'Lightning Greaves';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function aimed(): { g: Game; hawk: InstanceId; bears: InstanceId; worn: InstanceId; spare: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL], [HAWK, BEARS, GREAVES, GREAVES]],
    scripts: createRegistry([EATEN_BY_SPIDERS_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  const hawk = put(g, 'p2', HAWK);
  const bears = put(g, 'p2', BEARS);
  const worn = put(g, 'p2', GREAVES);
  const spare = put(g, 'p2', GREAVES);
  must(g.submit({ t: 'ManualAttach', player: 'p2', card: worn, to: hawk }));
  settle(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain' && s.priority.awaiting === null, 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, hawk, bears, worn, spare };
}

describe('Eaten by Spiders', () => {
  test('the flyer and its worn Greaves die; the spare Greaves stand', () => {
    const { g, hawk, worn, spare } = aimed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: hawk }] }));
    settle(g);
    expect(g.state.cards[hawk]?.zone).toEqual({ kind: 'graveyard', player: 'p2' });
    expect(g.state.cards[worn]?.zone).toEqual({ kind: 'graveyard', player: 'p2' });
    expect(g.state.cards[spare]?.zone.kind).toBe('battlefield');
  });

  test('a ground creature is refused at the aim (D289)', () => {
    const { g, bears } = aimed();
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }).ok).toBe(false);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = EATEN_BY_SPIDERS.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, EATEN_BY_SPIDERS.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(EATEN_BY_SPIDERS.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g, hawk } = aimed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: hawk }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
