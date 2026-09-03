// `Soul Nova` — the attacking Bears and the Greaves it wears are exiled; the
// spare Greaves stand; a creature at home is refused (D291).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SOUL_NOVA_SCRIPT } from './soulNova';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Soul Nova';
const BEARS = 'Grizzly Bears';
const GREAVES = 'Lightning Greaves';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function aimed(): { g: Game; att: InstanceId; home: InstanceId; worn: InstanceId; spare: InstanceId } {
  const g = startedGame({ players: 2, decks: [[SPELL, BEARS, BEARS, GREAVES, GREAVES], []], scripts: createRegistry([SOUL_NOVA_SCRIPT]) });
  const att = put(g, 'p1', BEARS);
  const home = put(g, 'p1', BEARS);
  const worn = put(g, 'p1', GREAVES);
  const spare = put(g, 'p1', GREAVES);
  must(g.submit({ t: 'ManualAttach', player: 'p1', card: worn, to: att }));
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers', 20_000);
  must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: att, defender: { kind: 'player', id: 'p2' } }] }));
  advanceUntil(g, (s) => s.priority.player === 'p1' && s.priority.awaiting === null && (s.combat?.attackers.length ?? 0) > 0, 20_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, att, home, worn, spare };
}

describe('Soul Nova', () => {
  test('the attacker and its worn Greaves are exiled; the spare Greaves stand', () => {
    const { g, att, worn, spare } = aimed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: att }] }));
    settle(g);
    expect(g.state.cards[att]?.zone.kind).toBe('exile');
    expect(g.state.cards[worn]?.zone.kind).toBe('exile');
    expect(g.state.cards[spare]?.zone.kind).toBe('battlefield');
  });

  test('a creature that stayed home is refused (D291)', () => {
    const { g, home } = aimed();
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: home }] }).ok).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, att } = aimed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: att }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
