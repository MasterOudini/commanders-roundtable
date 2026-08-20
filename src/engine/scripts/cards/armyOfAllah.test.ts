// `Army of Allah` — attacking creatures get +2/+0: cast mid-combat with the
// attack declared (Aetherize's window), every attacker pumped, the bystander
// not.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { ARMY_OF_ALLAH_SCRIPT } from './armyOfAllah';
import { ARMY_OF_ALLAH } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { derive } from '../../derive';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function midAttack(): { g: Game; attacker: InstanceId; bystander: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Army of Allah', 'Grizzly Bears', 'Llanowar Elves'], ['Grizzly Bears']],
    scripts: createRegistry([ARMY_OF_ALLAH_SCRIPT]),
  });
  const attacker = put(g, 'p1', 'Grizzly Bears');
  const bystander = put(g, 'p1', 'Llanowar Elves');
  settle(g);
  holdEverywhere(g);
  advanceUntil(
    g,
    (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers',
    60_000,
  );
  must(
    g.submit({
      t: 'DeclareAttackers',
      player: 'p1',
      attackers: [{ card: attacker, defender: { kind: 'player', id: 'p2' } }],
    }),
  );
  advanceUntil(g, (s) => s.priority.player === 'p1' && (s.combat?.attackers.length ?? 0) > 0, 20_000);
  const spell = put(g, 'p1', 'Army of Allah', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, attacker, bystander };
}

describe('Army of Allah', () => {
  test('the attacker gets +2/+0 mid-combat; the bystander gets nothing', () => {
    const { g, attacker, bystander } = midAttack();
    expect(derive(g.state, g.deps.oracle, g.deps.scripts, attacker).power).toBe(4);
    expect(derive(g.state, g.deps.oracle, g.deps.scripts, attacker).toughness).toBe(2);
    expect(derive(g.state, g.deps.oracle, g.deps.scripts, bystander).power).toBe(1);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = ARMY_OF_ALLAH.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, ARMY_OF_ALLAH.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(ARMY_OF_ALLAH.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = midAttack();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
