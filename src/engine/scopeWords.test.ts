// D624 - THE SCOPE WORDS. The closed scope vocabulary (D383) widened by the phrases the leftover prints most: `each
// creature your opponents control` / `you don't control`, `each creature and (each) planeswalker` (a controller phrase
// too), `creatures you don't control`, `creature tokens`, `permanents you control gain <keyword>`, `creatures target
// player / opponent controls` (the aimed player's creatures), and the multi-type sweeps `all artifacts and enchantments`,
// `all artifacts, creatures, and enchantments`, `all planeswalkers`. What is proven: the readings; the damage to the
// opponents' creatures alone; the damage to every creature and every planeswalker; the shrink of the creatures a
// player does not control; the tokens shrunk and the cards not; the permanents a player controls gaining a keyword; the
// aimed player's creatures; the multi-type destroy and the planeswalker exile; the replay hash.
import { describe, expect, test } from 'vitest';
import { parseEffects } from '../data/effectParse';
import { SOLDIER_TOKEN } from '../data/fixtures/engineCards';
import { derive } from './derive';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { vocabularyEffects, vocabularyTargets } from './scripts/vocabulary';
import { advanceUntil, holdEverywhere, must, put, startedGame, ORACLE } from './testing/harness';
import type { CardScript } from './scripts/api';
import type { EventBody } from './types/events';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const main = (g: Game, turn: number) => advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
const mana = (g: Game, symbols: string) => { for (const s of symbols) must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: s as 'W' | 'U' | 'B' | 'R' | 'G' | 'C', amount: 1 })); };
const spec = (text: string) => { const p = parseEffects(text, 'Thing', true); return { mode: p.mode, kinds: p.effects.map((e) => e.kind), scopes: p.effects[0]?.scopes ?? null, targetIndex: p.effects[0]?.targetIndex, keywords: p.effects[0]?.keywords ?? [] }; };
const HOST = 'Elvish Rejuvenator';
/** An enters trigger on the host whose payload is the sentence under test. */
function entersWith(payload: string): CardScript {
  const card = ORACLE.byName(HOST);
  if (!card) throw new Error(HOST + ' is not in the fixtures');
  const effects = vocabularyEffects(payload, HOST);
  const targets = vocabularyTargets(payload);
  return {
    oracleId: card.oracleId, name: HOST,
    triggers: [{
      abilityId: 'etb-0', text: card.faces[0]?.oracleText ?? '', event: 'CardsMoved', activeZones: ['battlefield'], optional: false, targets,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield'),
      label: () => HOST + ' - scope',
      resolve: (ctx, _self, obj): readonly EventBody[] => ctx.vocabulary(obj, effects, targets),
    }],
  };
}
type Board = { g: Game; mine: Record<string, InstanceId>; theirs: Record<string, InstanceId> };
const FIX = ['Grizzly Bears', 'Sol Ring', "Ajani's Mantra", 'Jace Beleren'];
/** Both sides armed with a creature, an artifact, an enchantment and a planeswalker; the host cast on turn 3. */
function fire(payload: string, opts: { tokens?: boolean; aim?: string } = {}): Board {
  const g = startedGame({ players: 2, decks: [[HOST, ...FIX], [...FIX]], scripts: createRegistry([entersWith(payload)]) });
  holdEverywhere(g);
  const host = put(g, 'p1', HOST, 'hand');
  main(g, 3);
  const mine: Record<string, InstanceId> = {};
  const theirs: Record<string, InstanceId> = {};
  for (const n of FIX) { mine[n] = put(g, 'p1', n); theirs[n] = put(g, 'p2', n); }
  if (opts.tokens) {
    must(g.submit({ t: 'ManualCreateToken', player: 'p1', printingId: SOLDIER_TOKEN.scryfallId, count: 1 }));
    must(g.submit({ t: 'ManualCreateToken', player: 'p2', printingId: SOLDIER_TOKEN.scryfallId, count: 1 }));
  }
  settle(g);
  mana(g, 'GGG');
  must(g.submit({ t: 'CastSpell', player: 'p1', card: host, targets: [] }));
  if (opts.aim) {
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: opts.aim }] }));
  }
  settle(g);
  return { g, mine, theirs };
}
const zone = (g: Game, id: InstanceId | undefined) => (id === undefined ? undefined : g.state.cards[id]?.zone.kind);
const pt = (g: Game, id: InstanceId | undefined) => { if (id === undefined) return null; const d = derive(g.state, g.deps.oracle, g.deps.scripts, id); return [d.power, d.toughness]; };
const tokensOf = (g: Game, p: string) => g.state.zones.battlefield.filter((id) => g.state.cards[id]?.isToken === true && g.state.cards[id]?.controller === p);

describe('D624 - the scope words', () => {
  test('the readings', () => {
    expect(spec('~ deals 2 damage to each creature your opponents control.')).toMatchObject({ mode: 'auto', kinds: ['damageEach'], scopes: [{ kind: 'creature', controller: 'opponents' }] });
    expect(spec("~ deals 2 damage to each creature you don't control.")).toMatchObject({ mode: 'auto', scopes: [{ kind: 'creature', controller: 'opponents' }] });
    expect(spec('~ deals 3 damage to each creature and each planeswalker.')).toMatchObject({ mode: 'auto', scopes: [{ kind: 'creature', controller: 'any' }, { kind: 'permanent', controller: 'any', type: 'Planeswalker' }] });
    expect(spec("~ deals 1 damage to each creature and planeswalker you don't control.")).toMatchObject({ mode: 'auto', scopes: [{ kind: 'creature', controller: 'opponents' }, { kind: 'permanent', controller: 'opponents', type: 'Planeswalker' }] });
    expect(spec("Creatures you don't control get -2/-0 until end of turn.")).toMatchObject({ mode: 'auto', kinds: ['massPump'], scopes: [{ kind: 'creature', controller: 'opponents' }] });
    expect(spec('Creature tokens get -2/-2 until end of turn.')).toMatchObject({ mode: 'auto', kinds: ['massPump'], scopes: [{ kind: 'creature', controller: 'any', token: true }] });
    expect(spec('Permanents you control gain indestructible until end of turn.')).toMatchObject({ mode: 'auto', kinds: ['massPump'], keywords: ['indestructible'], scopes: [{ kind: 'permanent', controller: 'you' }] });
    expect(spec('Permanents you control gain hexproof and indestructible until end of turn.')).toMatchObject({ mode: 'auto', keywords: ['hexproof', 'indestructible'] });
    expect(spec('Creatures target opponent controls get -1/-1 until end of turn.')).toMatchObject({ mode: 'auto', kinds: ['massPump'], targetIndex: 0, scopes: [{ kind: 'creature', controller: 'target' }] });
    expect(spec('Creatures target player controls gain lifelink until end of turn.')).toMatchObject({ mode: 'auto', kinds: ['massPump'], targetIndex: 0, keywords: ['lifelink'] });
    expect(spec('Destroy all artifacts and enchantments.')).toMatchObject({ mode: 'auto', kinds: ['destroyAll'], scopes: [{ kind: 'permanent', type: 'Artifact' }, { kind: 'permanent', type: 'Enchantment' }] });
    expect(spec('Destroy all artifacts, creatures, and enchantments.')).toMatchObject({ mode: 'auto', kinds: ['destroyAll'], scopes: [{ type: 'Artifact' }, { kind: 'creature' }, { type: 'Enchantment' }] });
    expect(spec('Exile all planeswalkers.')).toMatchObject({ mode: 'auto', kinds: ['exileAll'], scopes: [{ kind: 'permanent', type: 'Planeswalker' }] });
  });

  test("the damage to the opponents' creatures alone; then to every creature and every planeswalker", () => {
    const a = fire('~ deals 2 damage to each creature your opponents control.');
    expect(zone(a.g, a.theirs['Grizzly Bears'])).toBe('graveyard');
    expect(zone(a.g, a.mine['Grizzly Bears'])).toBe('battlefield');
    expect(a.g.state.cards[a.mine['Grizzly Bears'] as InstanceId]?.damage ?? 0).toBe(0);
    expect(stateHash(replay(a.g.log, a.g.seed))).toBe(a.g.hash());
    const b = fire('~ deals 3 damage to each creature and each planeswalker.');
    for (const side of [b.mine, b.theirs]) {
      expect(zone(b.g, side['Grizzly Bears'])).toBe('graveyard');
      expect(zone(b.g, side['Jace Beleren']), 'three damage takes three loyalty').toBe('graveyard');
      expect(zone(b.g, side['Sol Ring'])).toBe('battlefield');
    }
  });

  test("the creatures a player does not control shrink; the tokens shrink and the cards do not", () => {
    const a = fire("Creatures you don't control get -2/-0 until end of turn.");
    expect(pt(a.g, a.theirs['Grizzly Bears'])).toEqual([0, 2]);
    expect(pt(a.g, a.mine['Grizzly Bears'])).toEqual([2, 2]);
    const b = fire('Creature tokens get -2/-2 until end of turn.', { tokens: true });
    expect(tokensOf(b.g, 'p1')).toEqual([]);
    expect(tokensOf(b.g, 'p2')).toEqual([]);
    expect(pt(b.g, b.mine['Grizzly Bears'])).toEqual([2, 2]);
    expect(pt(b.g, b.theirs['Grizzly Bears'])).toEqual([2, 2]);
  });

  test("the permanents a player controls gain a keyword; the aimed player's creatures shrink", () => {
    const a = fire('Permanents you control gain indestructible until end of turn.');
    for (const n of ['Grizzly Bears', 'Sol Ring', "Ajani's Mantra"]) {
      expect(derive(a.g.state, a.g.deps.oracle, a.g.deps.scripts, a.mine[n] as InstanceId).keywords.has('indestructible'), 'mine: ' + n).toBe(true);
      expect(derive(a.g.state, a.g.deps.oracle, a.g.deps.scripts, a.theirs[n] as InstanceId).keywords.has('indestructible'), 'theirs: ' + n).toBe(false);
    }
    const b = fire('Creatures target opponent controls get -1/-1 until end of turn.', { aim: 'p2' });
    expect(pt(b.g, b.theirs['Grizzly Bears'])).toEqual([1, 1]);
    expect(pt(b.g, b.mine['Grizzly Bears'])).toEqual([2, 2]);
    expect(stateHash(replay(b.g.log, b.g.seed))).toBe(b.g.hash());
  });

  test('the multi-type destroy; the planeswalker exile', () => {
    const a = fire('Destroy all artifacts and enchantments.');
    for (const side of [a.mine, a.theirs]) {
      expect(zone(a.g, side['Sol Ring'])).toBe('graveyard');
      expect(zone(a.g, side["Ajani's Mantra"])).toBe('graveyard');
      expect(zone(a.g, side['Grizzly Bears'])).toBe('battlefield');
    }
    const b = fire('Exile all planeswalkers.');
    for (const side of [b.mine, b.theirs]) {
      expect(zone(b.g, side['Jace Beleren'])).toBe('exile');
      expect(zone(b.g, side['Grizzly Bears'])).toBe('battlefield');
    }
    expect(stateHash(replay(b.g.log, b.g.seed))).toBe(b.g.hash());
  });
});
