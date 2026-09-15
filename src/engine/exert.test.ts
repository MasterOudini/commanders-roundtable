// D443 - EXERT (CR 701.39): `You may exert this creature as it attacks. When you do, ...` - the attack declaration
// carries the choice, the prompt lists which attackers a script lets the player exert, the exerted creature misses
// its controller's next untap step (D411's field) and its `When you do` fires on the `Exerted` event. A card with the
// line and no script cannot be exerted: the untap would be paid for nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { vocabularyEffects } from './scripts/vocabulary';
import type { CardScript } from './scripts/api';
import type { EventBody } from './types/events';
import { GRIZZLY_BEARS, KHENRA_SCRAPPER } from '../data/fixtures/engineCards';
import { parseExertsOnAttack } from '../data/oracleParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';

const PUMP = vocabularyEffects('It gets +2/+0 until end of turn.', KHENRA_SCRAPPER.name);
const SCRAPPER: CardScript = {
  oracleId: KHENRA_SCRAPPER.oracleId,
  name: KHENRA_SCRAPPER.name,
  triggers: [
    {
      abilityId: 'exertAttack-0',
      text: 'You may exert this creature as it attacks. When you do, it gets +2/+0 until end of turn.',
      event: 'Exerted',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'Exerted' && ev.card === self,
      label: () => 'Khenra Scrapper - it gets +2/+0 until end of turn.',
      resolve: (ctx, _self, obj): readonly EventBody[] => ctx.vocabulary(obj, PUMP, []),
    },
  ],
};

// A watcher on the Bears: a script that fires on exerts does not let a creature without the printed permission be exerted.
const BEARS_WATCH: CardScript = {
  oracleId: GRIZZLY_BEARS.oracleId,
  name: GRIZZLY_BEARS.name,
  triggers: [{ ...SCRAPPER.triggers![0]!, abilityId: 'youExertCreature-0', text: 'Whenever you exert a creature, it gets +2/+0 until end of turn.', matches: (ctx, self, ev) => ev.t === 'Exerted' && ev.player === ctx.query.controllerOf(self) }],
};

const FORESTS = ['Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest'];
function board(scripted: boolean): { g: Game; scrapper: string; bears: string } {
  const g = startedGame({
    players: 2,
    decks: [['Khenra Scrapper', 'Grizzly Bears', ...FORESTS], [...FORESTS]],
    scripts: createRegistry(scripted ? [SCRAPPER, BEARS_WATCH] : []),
    options: { maxHandSize: null },
  });
  holdEverywhere(g);
  const scrapper = put(g, 'p1', 'Khenra Scrapper');
  const bears = put(g, 'p1', 'Grizzly Bears');
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers', 20_000);
  return { g, scrapper, bears };
}
function attackPrompt(g: Game) {
  const a = g.state.priority.awaiting;
  if (a?.kind !== 'declareAttackers') throw new Error(`expected the attackers prompt, got ${a?.kind ?? 'none'}`);
  return a;
}
const p2 = { kind: 'player' as const, id: 'p2' };

describe('exert (D443)', () => {
  test('the prompt lists the scripted exert creature and not the Bears; the exert taps it, pumps it and holds its untap', () => {
    const { g, scrapper, bears } = board(true);
    expect(attackPrompt(g).exertable).toEqual([scrapper]);
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: scrapper, defender: p2, exert: true }, { card: bears, defender: p2 }] }));
    expect(g.log.some((e) => e.body.t === 'Exerted' && e.body.card === scrapper && e.body.player === 'p1')).toBe(true);
    expect(g.state.cards[scrapper]?.skipsUntap).toBe(true);
    expect(g.state.cards[bears]?.skipsUntap).not.toBe(true);
    advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
    expect(g.state.untilEndOfTurn.some((m) => m.card === scrapper && m.power === 2)).toBe(true);
    // Its controller's next untap step leaves it tapped; the one after untaps it.
    advanceUntil(g, (s) => s.turn.turnNumber === 5 && s.turn.step === 'upkeep', 40_000);
    expect(g.state.cards[scrapper]?.tapped, 'exerted: still tapped after the next untap step').toBe(true);
    expect(g.state.cards[bears]?.tapped, 'the Bears untapped').toBe(false);
    expect(g.state.cards[scrapper]?.skipsUntap).not.toBe(true);
    advanceUntil(g, (s) => s.turn.turnNumber === 7 && s.turn.step === 'upkeep', 60_000);
    expect(g.state.cards[scrapper]?.tapped, 'untapped the turn after').toBe(false);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('the permission is printed and the script must fire: both halves alone are refused', () => {
    expect(parseExertsOnAttack('You may exert this creature as it attacks.\nWhenever you exert a creature, creatures you control get +1/+0 until end of turn.', 'Trueheart Twins')).toBe(true);
    expect(parseExertsOnAttack('You may exert Anep as it attacks. When you do, exile the top two cards of your library.', 'Anep')).toBe(true);
    expect(parseExertsOnAttack("If this creature hasn't been exerted this turn, you may exert it as it attacks. When you do, untap all other creatures you control.", 'Combat Celebrant')).toBe(false);
    expect(parseExertsOnAttack('Whenever you exert a creature, draw a card.', 'X')).toBe(false);
    // The Bears carry a script that fires on exerts and no printed permission: not exertable (CR 701.39a).
    const { g: g1, bears: b1 } = board(true);
    expect(attackPrompt(g1).exertable).not.toContain(b1);
    expect(g1.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: b1, defender: p2, exert: true }] }).ok).toBe(false);
    const { g, scrapper, bears } = board(false);
    expect(attackPrompt(g).exertable).toEqual([]);
    const r = g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: scrapper, defender: p2, exert: true }] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/can't be exerted/);
    expect(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: bears, defender: p2, exert: true }] }).ok).toBe(false);
    // Without the flag the same creature attacks as any other, and nothing is exerted.
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: scrapper, defender: p2 }] }));
    expect(g.log.some((e) => e.body.t === 'Exerted')).toBe(false);
    expect(g.state.cards[scrapper]?.skipsUntap).not.toBe(true);
  });

  test('attacking without exerting fires nothing, and the creature untaps as usual', () => {
    const { g, scrapper } = board(true);
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: scrapper, defender: p2 }] }));
    advanceUntil(g, (s) => s.turn.turnNumber === 5 && s.turn.step === 'upkeep', 40_000);
    expect(g.log.some((e) => e.body.t === 'Exerted')).toBe(false);
    expect(g.log.some((e) => e.body.t === 'AbilityPutOnStack' && /exertAttack/.test(e.body.obj.abilityRef ?? ''))).toBe(false);
    expect(g.state.cards[scrapper]?.tapped).toBe(false);
  });
});
