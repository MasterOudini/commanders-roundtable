// D597 - THE TYPED EQUIP (CR 702.6): "Equip [quality] [cost]" means "[Cost]: Attach this permanent to target [quality]
// creature you control. Activate only as a sorcery." The quality is the target's restriction - a creature subtype
// (Steelclaw Lance's `Equip Knight {1}`) or `legendary creature` (Blackblade Reforged's `Equip legendary creature {3}`) -
// and the plain `Equip {N}` printed beside it stays its own ability. `Equip {N}. Activate only once each turn.` is the
// plain equip with the once-each-turn limit (Leather Armor). A quality the target reader cannot restrict by (`commander`,
// `creature token`, a list of subtypes) is not synthesized: a looser target than the card prints is the one direction D90
// forbids.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import { parseActivatedAbilities } from '../data/activatedParse';
import { engineCompleteness } from '../data/engineComplete';
import { parseManaCost } from '../data/oracleParse';
import { BLACKBLADE_REFORGED, LEATHER_ARMOR, STEELCLAW_LANCE } from '../data/fixtures/engineCards';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const parse = (text: string) =>
  parseActivatedAbilities({ oracleText: text, isPermanent: true, producesMana: [], parseCost: (raw) => parseManaCost(raw) });

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(equipment: string): { g: Game; eq: InstanceId; knight: InstanceId; bears: InstanceId; krenko: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[equipment, 'Elite Headhunter', 'Grizzly Bears', 'Krenko, Mob Boss'], ['Cyclops of One-Eyed Pass']],
    scripts: createRegistry([]),
  });
  holdEverywhere(g);
  const eq = put(g, 'p1', equipment);
  const knight = put(g, 'p1', 'Elite Headhunter');
  const bears = put(g, 'p1', 'Grizzly Bears');
  const krenko = put(g, 'p1', 'Krenko, Mob Boss');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  return { g, eq, knight, bears, krenko };
}

const mana = (g: Game, n: number): void => {
  if (n > 0) must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: n }));
};

describe('the typed equip (D597, CR 702.6)', () => {
  test('`Equip Knight {1}` is synthesized: sorcery speed, a Knight creature you control, the line claimed', () => {
    const abilities = parse('Equipped creature gets +2/+2.\nEquip Knight {1}\nEquip {3}');
    expect(abilities).toHaveLength(2);
    const typed = abilities[0];
    expect(typed?.equip?.line).toBe('Equip Knight {1}');
    expect(typed?.equip?.quality).toBe('Knight');
    expect(typed?.sorceryOnly).toBe(true);
    expect(typed?.payable).toBe(true);
    expect(typed?.targets).toHaveLength(1);
    expect(typed?.targets[0]?.kinds).toEqual(['creature']);
    expect(typed?.targets[0]?.controller).toBe('you');
    expect(typed?.targets[0]?.restrict).toEqual({ subtypesAll: ['Knight'] });
    expect(abilities[1]?.equip?.line).toBe('Equip {3}');
    expect(abilities[1]?.equip?.quality).toBeUndefined();
  });

  test('`Equip legendary creature {3}` restricts to a legendary creature you control', () => {
    const typed = parse('Equip legendary creature {3}')[0];
    expect(typed?.equip?.quality).toBe('legendary creature');
    expect(typed?.targets[0]?.restrict).toEqual({ supertypesAny: ['Legendary'] });
    expect(typed?.targets[0]?.controller).toBe('you');
  });

  test('a quality the target reader cannot restrict by is not synthesized', () => {
    expect(parse('Equip commander {2}')).toHaveLength(0);
    expect(parse('Equip creature token {1}')).toHaveLength(0);
    expect(parse('Equip Shaman, Warlock, or Wizard {1}')).toHaveLength(0);
    expect(parse('Equip planeswalker {1}')).toHaveLength(0);
  });

  test('`Equip {0}. Activate only once each turn.` is the plain equip with the once-each-turn limit', () => {
    const abilities = parse('Equip {0}. Activate only once each turn.');
    expect(abilities).toHaveLength(1);
    expect(abilities[0]?.equip?.line).toBe('Equip {0}. Activate only once each turn.');
    expect(abilities[0]?.oncePerTurn).toBe(true);
    expect(abilities[0]?.targets[0]?.kinds).toEqual(['creature']);
  });

  test('the accounting no longer holds the typed Equip line against the card', () => {
    expect(engineCompleteness(STEELCLAW_LANCE).leftover).not.toContain('Equip Knight {1}');
    expect(engineCompleteness(BLACKBLADE_REFORGED).leftover).not.toContain('Equip legendary creature {3}');
    expect(engineCompleteness(LEATHER_ARMOR).leftover.some((l) => l.startsWith('Equip {0}'))).toBe(false);
  });

  test('Steelclaw Lance: the Knight equip attaches to the Knight and is refused on the Bears', () => {
    const { g, eq, knight, bears } = board('Steelclaw Lance');
    mana(g, 1);
    expect(g.submit({ t: 'ActivateAbility', player: 'p1', card: eq, abilityIndex: 0, targets: [{ kind: 'card', id: bears }] }).ok, 'the Bears is no Knight').toBe(false);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: eq, abilityIndex: 0, targets: [{ kind: 'card', id: knight }] }));
    settle(g);
    expect(g.state.cards[eq]?.attachedTo).toBe(knight);
  });

  test('Steelclaw Lance: the plain equip beside it attaches to any creature you control', () => {
    const { g, eq, bears } = board('Steelclaw Lance');
    mana(g, 3);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: eq, abilityIndex: 1, targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[eq]?.attachedTo).toBe(bears);
  });

  test('Blackblade Reforged: the legendary equip attaches to Krenko and is refused on the Bears', () => {
    const { g, eq, bears, krenko } = board('Blackblade Reforged');
    mana(g, 3);
    expect(g.submit({ t: 'ActivateAbility', player: 'p1', card: eq, abilityIndex: 0, targets: [{ kind: 'card', id: bears }] }).ok, 'the Bears is not legendary').toBe(false);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: eq, abilityIndex: 0, targets: [{ kind: 'card', id: krenko }] }));
    settle(g);
    expect(g.state.cards[eq]?.attachedTo).toBe(krenko);
  });

  test('Leather Armor: a second equip in the same turn is refused', () => {
    const { g, eq, bears, knight } = board('Leather Armor');
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: eq, abilityIndex: 0, targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[eq]?.attachedTo).toBe(bears);
    expect(g.submit({ t: 'ActivateAbility', player: 'p1', card: eq, abilityIndex: 0, targets: [{ kind: 'card', id: knight }] }).ok, 'once each turn').toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, eq, knight } = board('Steelclaw Lance');
    mana(g, 1);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: eq, abilityIndex: 0, targets: [{ kind: 'card', id: knight }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
