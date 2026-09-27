// D575 - THE DERIVED WARD (CR 702.21). What is proven here: parseWard and parseWardLife read a permanent's OWN ward and not
// one its text grants (`has ward {1}`, `have ward—Pay 2 life`); the derived wards carry the printed one and lose it with
// the abilities (Humility); a GRANTED ward (the Royal Role's) taxes an opponent's spell that targets the creature and not
// its controller's own; the card view carries the same wards the host taxes (the client's preview reads them - D53).
import { describe, expect, test } from 'vitest';
import { LLANOWAR_ELVES } from '../data/fixtures/engineCards';
import { parseWard, parseWardLife } from '../data/oracleParse';
import { derive } from './derive';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { AEGIS_SCULPTOR_SCRIPT } from './scripts/cards/aegisSculptor';
import { ROYAL_YOUNG_HERO_ROLE_SCRIPT } from './scripts/cards/royalYoungHeroRole';
import { vocabularyEffects, vocabularyTargets } from './scripts/vocabulary';
import { HUMILITY_SCRIPT } from './testing/cardScripts';
import { advanceUntil, holdEverywhere, must, put, startedGame, ORACLE } from './testing/harness';
import type { CardScript } from './scripts/api';
import type { Game } from './game';

const ROYAL = 'Create a Royal Role token attached to target creature you control.';
const ROYAL_E = vocabularyEffects(ROYAL, LLANOWAR_ELVES.name);
const ROYAL_T = vocabularyTargets(ROYAL);
const MAKER: CardScript = {
  oracleId: LLANOWAR_ELVES.oracleId,
  name: LLANOWAR_ELVES.name,
  triggers: [
    {
      abilityId: 'etb-royal',
      text: 'When this creature enters, ' + ROYAL,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      targets: ROYAL_T,
      label: () => 'Llanowar Elves - a Royal Role',
      resolve: (ctx, _self, obj) => ctx.vocabulary(obj, ROYAL_E, ROYAL_T),
    },
  ],
};
const ISLANDS = ['Island', 'Island', 'Island', 'Island', 'Island', 'Island', 'Island', 'Island'];
const wardsOf = (g: Game, id: string) => derive(g.state, ORACLE, g.deps.scripts, id).wards.map((w) => [w.wardCost?.raw ?? null, w.wardLife]);

describe('D575 - the derived ward', () => {
  test('the parse: a permanent' + String.fromCharCode(39) + 's own ward, never one its text grants', () => {
    expect(parseWard('Ward {2}')?.raw).toBe('{2}');
    expect(parseWard('Flying, ward {1}')?.raw).toBe('{1}');
    expect(parseWard('Enchant creature' + String.fromCharCode(10) + 'Enchanted creature gets +1/+1 and has ward {1}.')).toBeNull();
    expect(parseWard('Creatures you control have ward {1}.')).toBeNull();
    expect(parseWard('Equipped creature gains ward {2} until end of turn.')).toBeNull();
    // A ward the card gives itself stays its own (conditional - the face cannot hold the condition either way).
    expect(parseWard('Iymrith has ward {4} as long as it' + String.fromCharCode(39) + 's untapped.')?.raw).toBe('{4}');
    expect(parseWardLife('Ward' + String.fromCharCode(8212) + 'Pay 3 life.')).toBe(3);
    expect(parseWardLife('Creatures you control have ward' + String.fromCharCode(8212) + 'Pay 2 life.')).toBe(0);
  });

  test('the derived wards: the printed one, gone with the abilities', () => {
    const scripts = createRegistry([AEGIS_SCULPTOR_SCRIPT, HUMILITY_SCRIPT]);
    const g = startedGame({ players: 2, decks: [['Aegis Sculptor', 'Humility', ...ISLANDS], [...ISLANDS]], scripts, options: { maxHandSize: null } });
    holdEverywhere(g);
    const sculptor = put(g, 'p1', 'Aegis Sculptor');
    expect(wardsOf(g, sculptor)).toEqual([['{2}', 0]]);
    put(g, 'p1', 'Humility');
    expect(wardsOf(g, sculptor), 'Humility: no abilities, no ward').toEqual([]);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a granted ward taxes an opponent' + String.fromCharCode(39) + 's spell, and the view carries it for the client', () => {
    const scripts = createRegistry([ROYAL_YOUNG_HERO_ROLE_SCRIPT, MAKER]);
    const g = startedGame({ players: 2, decks: [['Grizzly Bears', 'Llanowar Elves', ...ISLANDS], ['Lightning Bolt', ...ISLANDS]], scripts, options: { maxHandSize: null } });
    holdEverywhere(g);
    const bears = put(g, 'p1', 'Grizzly Bears');
    advanceUntil(g, (s) => s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 20_000);
    put(g, 'p1', 'Llanowar Elves');
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
    expect(wardsOf(g, bears), 'the Royal Role grants ward {1}').toEqual([['{1}', 0]]);
    expect(g.view('p2').cards[bears]?.wards?.map((w) => w.wardCost?.raw), 'the view carries it').toEqual(['{1}']);
    const bolt = put(g, 'p2', 'Lightning Bolt', 'hand');
    advanceUntil(g, (s) => s.turn.turnNumber === 2 && s.turn.phase === 'precombatMain' && s.priority.player === 'p2' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
    must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'R', amount: 1 }));
    const unpaid = g.submit({ t: 'CastSpell', player: 'p2', card: bolt, targets: [{ kind: 'card', id: bears }] });
    expect(unpaid.ok, 'Bolt alone cannot pay the ward').toBe(false);
    must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p2', card: bolt, targets: [{ kind: 'card', id: bears }] }));
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
