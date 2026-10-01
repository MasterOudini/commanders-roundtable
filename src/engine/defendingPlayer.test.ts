// D606 - THE DEFENDING PLAYER AS A TARGET'S CONTROLLER. `Whenever this creature attacks, tap target creature defending
// player controls.` (Fiend Binder, Star-Crowned Stag, Master of Diversion), `Whenever equipped creature attacks, ...`
// (Captain America's Shield, Thunder Lasso) - CR 508.5: an ability of an attacking creature that refers to a defending
// player means the player that creature is attacking (a planeswalker's or a battle's controller), and CR 508.5a: one
// specific player, never every defending player. The target reader reads the phrase as its own controller ('defending');
// the targeting source carries the player its attacker - the source, or the creature the source is attached to - is
// attacking. What is proven: the reader; in a three-player game the attacked player's creature is a legal target and the
// third player's is not; the hash.
import { describe, expect, test } from 'vitest';
import { parseTargetClauses } from '../data/targetParse';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { vocabularyEffects, vocabularyTargets } from './scripts/vocabulary';
import { advanceUntil, clearSickness, holdEverywhere, must, put, startedGame, ORACLE } from './testing/harness';
import type { CardScript } from './scripts/api';
import type { EventBody } from './types/events';
import type { Game } from './game';

const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const TEN = ['Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest'];
const TAP = 'tap target creature defending player controls.';

/** A self-attack head on `name` whose payload the vocabulary reads (the generated attack-head shape). */
function attackHead(name: string, payload: string): CardScript {
  const card = ORACLE.byName(name);
  if (!card) throw new Error(name + ' is not in the fixtures');
  const effects = vocabularyEffects(payload, name);
  const targets = vocabularyTargets(payload);
  return {
    oracleId: card.oracleId,
    name,
    triggers: [{
      abilityId: 'attacks-0',
      text: card.faces[0]?.oracleText ?? '',
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      targets,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => name + ' - ' + payload,
      resolve: (ctx, _self, obj): readonly EventBody[] => ctx.vocabulary(obj, effects, targets),
    }],
  };
}

describe('D606 - the defending player as a target' + String.fromCharCode(39) + 's controller', () => {
  test('the reader reads the phrase as its own controller', () => {
    const [clause] = parseTargetClauses('Tap target creature defending player controls.');
    expect([clause?.controller, clause?.confident, clause?.unenforced]).toEqual(['defending', true, []]);
    expect(vocabularyEffects(TAP, 'Fiend Binder').map((e) => [e.kind, e.targetIndex])).toEqual([['tap', 0]]);
  });

  test('in a three-player game the attacked player' + String.fromCharCode(39) + 's creature is legal and the third player' + String.fromCharCode(39) + 's is not', () => {
    const g = startedGame({ players: 3, decks: [['Grizzly Bears', ...TEN], ['Cyclops of One-Eyed Pass', ...TEN], ['Steel Wall', ...TEN]], scripts: createRegistry([attackHead('Grizzly Bears', TAP)]) });
    settle(g);
    holdEverywhere(g);
    const bears = put(g, 'p1', 'Grizzly Bears');
    const cyclops = put(g, 'p2', 'Cyclops of One-Eyed Pass');
    const wall = put(g, 'p3', 'Steel Wall');
    clearSickness(g);
    settle(g);
    advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.turnNumber > 1 && s.priority.awaiting?.kind === 'declareAttackers', 20_000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: bears, defender: { kind: 'player', id: 'p2' } }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: wall }] }).ok, 'p3 is not the defending player').toBe(false);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: cyclops }] }));
    settle(g);
    expect(g.state.cards[cyclops]?.tapped, 'the attacked player' + String.fromCharCode(39) + 's creature').toBe(true);
    expect(g.state.cards[wall]?.tapped).toBe(false);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('an Equipment' + String.fromCharCode(39) + 's head binds the player its equipped creature attacks, with two players attacked', () => {
    const shortSword = ORACLE.byName('Short Sword');
    if (!shortSword) throw new Error('Short Sword is not in the fixtures');
    const effects = vocabularyEffects(TAP, 'Short Sword');
    const targets = vocabularyTargets(TAP);
    const equipHead: CardScript = {
      oracleId: shortSword.oracleId,
      name: 'Short Sword',
      triggers: [{
        abilityId: 'equippedCreatureAttacks-0',
        text: shortSword.faces[0]?.oracleText ?? '',
        event: 'AttackersDeclared',
        activeZones: ['battlefield'],
        optional: false,
        targets,
        matches: (ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === ctx.state.cards[self]?.attachedTo),
        label: () => 'Short Sword - ' + TAP,
        resolve: (ctx, _self, obj): readonly EventBody[] => ctx.vocabulary(obj, effects, targets),
      }],
    };
    const g = startedGame({ players: 3, decks: [['Grizzly Bears', 'Raging Goblin', 'Short Sword', ...TEN], ['Cyclops of One-Eyed Pass', ...TEN], ['Steel Wall', ...TEN]], scripts: createRegistry([equipHead]) });
    settle(g);
    holdEverywhere(g);
    const bears = put(g, 'p1', 'Grizzly Bears');
    const goblin = put(g, 'p1', 'Raging Goblin');
    const sword = put(g, 'p1', 'Short Sword');
    const cyclops = put(g, 'p2', 'Cyclops of One-Eyed Pass');
    const wall = put(g, 'p3', 'Steel Wall');
    must(g.submit({ t: 'ManualAttach', player: 'p1', card: sword, to: bears }));
    clearSickness(g);
    settle(g);
    advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.turnNumber > 1 && s.priority.awaiting?.kind === 'declareAttackers', 20_000);
    // The equipped Bears attack p3, the Goblin p2: the sole-defender fallback cannot answer, only the host's lane can.
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: bears, defender: { kind: 'player', id: 'p3' } }, { card: goblin, defender: { kind: 'player', id: 'p2' } }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: cyclops }] }).ok, 'p2 is the Goblin' + String.fromCharCode(39) + 's defending player, not the Bears' + String.fromCharCode(39)).toBe(false);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: wall }] }));
    settle(g);
    expect(g.state.cards[wall]?.tapped, 'the equipped creature' + String.fromCharCode(39) + 's defending player' + String.fromCharCode(39) + 's creature').toBe(true);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
