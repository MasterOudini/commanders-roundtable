// D620 - ASCEND AND THE CITY'S BLESSING (CR 702.131). `Ascend` on a permanent: a player with no blessing who controls one
// and ten or more permanents gets the city's blessing - the state check, at once (a static ability). On an instant or
// sorcery: as it resolves. The blessing stays for the rest of the game, public; `if you have the city's blessing` gates an
// activation; a manual tool sets it. What is proven: the reads; the blessing at ten permanents with an ascend permanent
// and not at nine, nor at ten without one, kept after the count falls; the spell's ascend as it resolves; an activation
// refused without the blessing and allowed with it; the seat; the hashes.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { legalActions } from './legal';
import { project } from './project';
import { createRegistry } from './scripts/registryCore';
import { vocabularyEffects, vocabularyTargets } from './scripts/vocabulary';
import { advanceUntil, holdEverywhere, must, ORACLE, put, startedGame } from './testing/harness';
import type { CardScript } from './scripts/api';
import type { EventBody } from './types/events';
import type { Game } from './game';

const CHARGER = 'Dusk Charger';
const ARCH = 'Arch of Orazca';
const SECRETS = 'Secrets of the Golden City';
const FORESTS: string[] = Array.from({ length: 14 }, () => 'Forest');
const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const blessed = (g: Game) => g.state.players.p1?.citysBlessing === true;

function archIndex(): number {
  const i = ORACLE.byName(ARCH)?.faces[0]?.activated.findIndex((a) => a.activateOnly.some((c) => c.kind === 'citysBlessing')) ?? -1;
  if (i < 0) throw new Error('no blessing-gated ability read on ' + ARCH);
  return i;
}

/** Arch of Orazca's `{5}, {T}: Draw a card. Activate only if you have the city's blessing.`, through the vocabulary. */
function archDef(): CardScript {
  const card = ORACLE.byName(ARCH);
  if (!card) throw new Error('no fixture');
  const payload = 'Draw a card.';
  const effects = vocabularyEffects(payload, ARCH);
  const targets = vocabularyTargets(payload);
  return { oracleId: card.oracleId, name: ARCH, activated: [{ ref: card.oracleId + '#a' + archIndex(), text: card.faces[0]?.oracleText ?? '', resolve: (ctx, _self, obj): readonly EventBody[] => ctx.vocabulary(obj, effects, targets) }] };
}

describe('D620 - ascend and the city' + "'" + 's blessing', () => {
  test('the keyword and the activation condition are read', () => {
    expect(ORACLE.byName(CHARGER)?.faces[0]?.keywords).toContain('ascend');
    expect(ORACLE.byName(SECRETS)?.faces[0]?.keywords).toContain('ascend');
    expect(ORACLE.byName(ARCH)?.faces[0]?.activated[archIndex()]?.activateOnly).toEqual([{ kind: 'citysBlessing' }]);
  });

  test('ten permanents and an ascend permanent give the blessing; nine do not, ten without one do not; it is kept', () => {
    const g = startedGame({ decks: [[CHARGER, ...FORESTS], [...FORESTS]], scripts: createRegistry([]) });
    holdEverywhere(g);
    for (let i = 0; i < 10; i++) put(g, 'p2', 'Forest');
    settle(g);
    expect(g.state.players.p2?.citysBlessing, 'ten permanents, no ascend').toBeUndefined();
    put(g, 'p1', CHARGER);
    const lands: string[] = [];
    for (let i = 0; i < 8; i++) lands.push(put(g, 'p1', 'Forest'));
    settle(g);
    expect(blessed(g), 'nine permanents').toBe(false);
    lands.push(put(g, 'p1', 'Forest'));
    settle(g);
    expect(blessed(g), 'ten permanents with ascend').toBe(true);
    for (const id of lands.slice(0, 4)) must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: id, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(blessed(g), 'for the rest of the game').toBe(true);
    expect(project(g.state, g.deps.oracle, g.deps.scripts, 'p2').seats.p1?.citysBlessing).toBe(true);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('an ascend spell gives it as it resolves', () => {
    const g = startedGame({ decks: [[SECRETS, ...FORESTS], [...FORESTS]], scripts: createRegistry([]) });
    holdEverywhere(g);
    for (let i = 0; i < 10; i++) put(g, 'p1', 'Forest');
    settle(g);
    expect(blessed(g), 'no ascend permanent').toBe(false);
    const id = put(g, 'p1', SECRETS, 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 2 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: id }));
    advanceUntil(g, (s) => s.cards[id]?.zone.kind !== 'stack' && s.stack.length === 0, 400);
    expect(blessed(g)).toBe(true);
  });

  test('a blessing-gated activation is refused without it and allowed with it', () => {
    const g = startedGame({ decks: [[ARCH, ...FORESTS], [...FORESTS]], scripts: createRegistry([archDef()]) });
    holdEverywhere(g);
    const arch = put(g, 'p1', ARCH);
    settle(g);
    expect(blessed(g)).toBe(false);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 5 }));
    const offered = () => legalActions(g.state, g.deps.oracle, g.deps.scripts, 'p1').some((a) => a.t === 'ActivateAbility' && a.card === arch && a.abilityIndex === archIndex());
    expect(offered()).toBe(false);
    expect(g.submit({ t: 'ActivateAbility', player: 'p1', card: arch, abilityIndex: archIndex() }).ok).toBe(false);
    must(g.submit({ t: 'ManualSetBlessing', player: 'p1', target: 'p1', has: true }));
    expect(offered()).toBe(true);
    const hand0 = (g.state.zones.hand.p1 ?? []).length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: arch, abilityIndex: archIndex() }));
    settle(g);
    expect((g.state.zones.hand.p1 ?? []).length).toBe(hand0 + 1);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
