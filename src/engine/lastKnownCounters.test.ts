// D612 - THE COUNTERS IT LEFT WITH. A trigger that looks back (CR 603.10a - `When ~ dies`, `When ~ leaves the battlefield`)
// counts its source's counters as the source last existed (CR 608.2h): `draw a card for each +1/+1 counter on it` (Vogar,
// Toothy), `create a 1/1 Bird for each age counter on it` (Jotun Owl Keeper). The pending trigger is stamped with the
// source's counters off the board before the move (`PendingTrigger.sourceCounters`), and the stamp rides onto the stack
// object D611's `selfCounters` count already reads. And THE QUESTS' COST: `Remove three quest counters from this
// enchantment and sacrifice it` is two cost pieces in one clause (a line longer than the prose-colon cap, indexed by its
// verb), and a removal counts past five (`Remove eight foreshadow counters`). What is proven: the Quest line and Ominous
// Seas' line are read as payable activations; a dying creature's two +1/+1 counters draw two; the hash.
import { describe, expect, test } from 'vitest';
import { parseActivatedAbilities } from '../data/activatedParse';
import { parseManaCost } from '../data/oracleParse';
import { splitAbilityLines } from '../data/targetParse';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { vocabularyEffects, vocabularyTargets } from './scripts/vocabulary';
import { advanceUntil, holdEverywhere, must, put, startedGame, ORACLE } from './testing/harness';
import type { CardScript } from './scripts/api';
import type { EventBody } from './types/events';
import type { Game } from './game';

const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const TEN = ['Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest'];
const GRAVELORD = 'Whenever a creature dies, you may put a quest counter on this enchantment.\nRemove three quest counters from this enchantment and sacrifice it: Create a 5/5 black Zombie Giant creature token.';
const SEAS = 'Whenever you draw a card, put a foreshadow counter on this enchantment.\nRemove eight foreshadow counters from this enchantment: Create an 8/8 blue Kraken creature token.\nCycling {2}';

/** A dies head on `name` whose payload the vocabulary reads (the generated dies shape: looks back). */
function diesHead(name: string, payload: string): CardScript {
  const card = ORACLE.byName(name);
  if (!card) throw new Error(name + ' is not in the fixtures');
  const effects = vocabularyEffects(payload, name);
  const targets = vocabularyTargets(payload);
  return {
    oracleId: card.oracleId,
    name,
    triggers: [{
      abilityId: 'dies-0',
      text: card.faces[0]?.oracleText ?? '',
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      targets,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => name + ' - ' + payload,
      resolve: (ctx, _self, obj): readonly EventBody[] => ctx.vocabulary(obj, effects, targets),
    }],
  };
}

describe('D612 - the counters it left with', () => {
  test("the Quests' remove-and-sacrifice line and a removal past five are payable activations", () => {
    expect(splitAbilityLines(GRAVELORD, true)[1]?.kind, 'the long Quest cost is a cost line').toBe('activated');
    const quest = parseActivatedAbilities({ oracleText: GRAVELORD, isPermanent: true, producesMana: [], parseCost: parseManaCost, selfName: 'Quest for the Gravelord', basePower: null });
    expect(quest.map((a) => [a.payable, a.removeCounterCost, a.sacrificesSelf])).toEqual([[true, { kind: 'quest', count: 3, from: null }, true]]);
    const seas = parseActivatedAbilities({ oracleText: SEAS, isPermanent: true, producesMana: [], parseCost: parseManaCost, selfName: 'Ominous Seas', basePower: null });
    expect(seas[0]?.payable).toBe(true);
    expect(seas[0]?.removeCounterCost).toEqual({ kind: 'foreshadow', count: 8, from: null });
  });

  test("a dying creature's two +1/+1 counters draw two", () => {
    const script = diesHead('Grizzly Bears', 'Draw a card for each +1/+1 counter on ~.');
    const g = startedGame({ players: 2, decks: [['Grizzly Bears', ...TEN], [...TEN]], scripts: createRegistry([script]) });
    settle(g);
    holdEverywhere(g);
    const bears = put(g, 'p1', 'Grizzly Bears');
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
    must(g.submit({ t: 'ManualSetCounter', player: 'p1', card: bears, kind: '+1/+1', delta: 2 }));
    const hand0 = (g.state.zones.hand.p1 ?? []).length;
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: bears, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect((g.state.zones.hand.p1 ?? []).length, 'two counters as it last existed - two cards').toBe(hand0 + 2);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
