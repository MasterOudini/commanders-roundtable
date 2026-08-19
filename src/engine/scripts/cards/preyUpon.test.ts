// `Prey Upon` — the fight: both deal at once, and the deathtouch rider is
// why the shape matters (the Strix kills whatever it fights, at 1 power).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { PREY_UPON_SCRIPT } from './preyUpon';
import { PREY_UPON } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function fight(theirsName: string): { g: Game; mine: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Prey Upon', 'Grizzly Bears'], ['Akroma, Angel of Wrath', 'Baleful Strix']],
    scripts: createRegistry([PREY_UPON_SCRIPT]),
  });
  const mine = put(g, 'p1', 'Grizzly Bears');
  const theirs = put(g, 'p2', theirsName);
  settle(g);
  const spell = put(g, 'p1', 'Prey Upon', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(
    g.submit({
      t: 'ChooseTargets',
      player: 'p1',
      targets: [
        { kind: 'card', id: mine },
        { kind: 'card', id: theirs },
      ],
    }),
  );
  settle(g);
  return { g, mine, theirs };
}

describe('Prey Upon', () => {
  test('2/2 into 6/6: the Bears die, Akroma survives carrying 2', () => {
    const { g, mine, theirs } = fight('Akroma, Angel of Wrath');
    expect(g.state.cards[mine]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[theirs]?.zone.kind).toBe('battlefield');
  });

  test('2/2 into the deathtouch Strix: BOTH die — the rider rides', () => {
    const { g, mine, theirs } = fight('Baleful Strix');
    expect(g.state.cards[mine]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = PREY_UPON.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, PREY_UPON.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(PREY_UPON.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = fight('Baleful Strix');
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
