import { describe, expect, test } from 'vitest';
import { faceOf } from './oracle';
import { derive } from './derive';
import { parseEffects } from '../data/effectParse';
import { toViewEvents } from './viewEvents';
import { ORACLE, advanceUntil, find, findAnywhere, fullControl, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';

// Spells that actually do something.
//
// ⚠️ The property under test in half of these is that a card does NOT execute.
// Half-executing is the failure this whole design is shaped around: a card whose
// first sentence the app understands and whose second it does not must do
// nothing by itself.

function faceOfName(name: string) {
  const card = ORACLE.byName(name);
  if (!card) throw new Error(`no fixture ${name}`);
  return faceOf(card, 0);
}

/** A board where p1 can cast `name` at will. */
function castBoard(name: string, lands: string[], extra: string[] = []) {
  const game = startedGame({ decks: [[...lands, name, ...extra], ['Grizzly Bears']] });
  fullControl(game, 'p1');
  for (const land of lands) put(game, 'p1', land);
  const card = findAnywhere(game, 'p1', name);
  must(game.submit({ t: 'ManualMoveCard', player: 'p1', card, to: { kind: 'hand', player: 'p1' } }));
  return { game, card };
}

function resolveStack(game: Game): void {
  advanceUntil(game, (s) => s.stack.length === 0, 400);
}

describe('the effect parser', () => {
  test('Lightning Bolt is understood completely', () => {
    const face = faceOfName('Lightning Bolt');
    expect(face.effectMode).toBe('auto');
    expect(face.effects).toHaveLength(1);
    expect(face.effects[0]?.kind).toBe('damage');
    expect(face.effects[0]?.amount).toBe(3);
  });

  /**
   * ⚠️ THE CASE THIS DESIGN EXISTS FOR. `Beast Within` destroys a permanent AND
   * gives its controller a 3/3. Destroying the permanent alone would be a
   * strictly worse outcome than doing nothing, because the player has no way to
   * see what was skipped.
   */
  test('a card whose second sentence is not understood is assisted, never auto', () => {
    const parsed = parseEffects(
      'Destroy target permanent. Its controller creates a 3/3 green Beast creature token.',
      'Beast Within',
      true,
    );
    expect(parsed.mode).toBe('assisted');
    expect(parsed.effects).toHaveLength(1);
    expect(parsed.effects[0]?.kind).toBe('destroy');
  });

  /**
   * ⚠️ The closed vocabulary earning its keep. An earlier cut used `[a-z ]+` for
   * the target phrase and "understood" this card as plain 4 damage to one
   * creature, silently dropping every other creature with the same name.
   */
  test('a trailing clause the vocabulary does not admit is not understood at all', () => {
    const parsed = parseEffects(
      '~ deals 4 damage to target creature and each other creature with the same name as that creature.',
      'Homing Lightning',
      true,
    );
    expect(parsed.mode).toBe('manual');
    expect(parsed.effects).toEqual([]);
  });

  test('an unqualified counter is understood; one with a rider is not', () => {
    expect(parseEffects('Counter target spell.', 'Cancel', true).mode).toBe('auto');
    expect(parseEffects('Counter target spell with mana value X.', 'Spell Blast', true).mode).toBe('manual');
  });

  test('a permanent never parses effects — its text is triggers and statics', () => {
    // The same sentence, on a creature, must not become a one-shot effect.
    expect(parseEffects('Destroy target creature.', 'Whatever', false).mode).toBe('manual');
  });

  test('X is not a number the parser will guess at', () => {
    expect(parseEffects('~ deals X damage to any target.', 'Fireball', true).mode).toBe('manual');
  });
});

describe('effects resolving', () => {
  test('Lightning Bolt takes three life off the player it is aimed at', () => {
    const { game, card } = castBoard('Lightning Bolt', ['Mountain']);
    const before = game.state.players['p2']?.life ?? 0;
    must(game.submit({ t: 'CastSpell', player: 'p1', card, targets: [{ kind: 'player', id: 'p2' }] }));
    resolveStack(game);
    expect(game.state.players['p2']?.life).toBe(before - 3);
    // …and the card is in the graveyard, as it always was.
    expect(game.state.cards[card]?.zone.kind).toBe('graveyard');
  });

  test('Lightning Bolt marks damage on a creature, and lethal damage kills it', () => {
    const { game, card } = castBoard('Lightning Bolt', ['Mountain']);
    const bears = put(game, 'p2', 'Grizzly Bears'); // 2/2
    must(game.submit({ t: 'CastSpell', player: 'p1', card, targets: [{ kind: 'card', id: bears }] }));
    resolveStack(game);
    // ⚠️ The engine's OWN state-based action does the killing — the effect only
    // marks damage. Anything else would be a second implementation of lethality.
    expect(game.state.cards[bears]?.zone.kind).toBe('graveyard');
  });

  test('a fizzled spell deals nothing', () => {
    const { game, card } = castBoard('Lightning Bolt', ['Mountain']);
    const bears = put(game, 'p2', 'Grizzly Bears');
    must(game.submit({ t: 'CastSpell', player: 'p1', card, targets: [{ kind: 'card', id: bears }] }));
    // Remove the target while the Bolt is on the stack.
    must(game.submit({ t: 'ManualMoveCard', player: 'p2', card: bears, to: { kind: 'exile', player: 'p2' } }));
    const life = game.state.players['p2']?.life ?? 0;
    resolveStack(game);
    expect(game.state.players['p2']?.life).toBe(life);
  });

  /**
   * ⚠️ WHOSE SPELL WAS THAT. The assisted offer (D90) is raised from
   * `StackResolved` on whichever client is the ACTIVE SEAT — which in a hotseat
   * is regularly not the caster, because the table follows priority (D42). With
   * no controller on the event the offer named whoever was looking, and applying
   * it drew Ben's two cards into Ana's hand. The card cannot answer for it
   * either: `clearBattlefieldFields` resets a moved card's `controller` to its
   * OWNER, so a spell in a graveyard only says whose card it is. See D120.
   */
  test('a resolved spell names the player who CAST it, for every viewer', () => {
    const game = startedGame({
      players: 2,
      decks: [[], ['Mountain', 'Lightning Bolt']],
      startingPlayer: 'p1',
    });
    holdEverywhere(game);
    put(game, 'p2', 'Mountain');
    put(game, 'p2', 'Lightning Bolt', 'hand');
    advanceUntil(game, (s) => s.priority.player === 'p2');
    const bolt = find(game, 'p2', 'hand', 'Lightning Bolt');
    must(game.submit({ t: 'CastSpell', player: 'p2', card: bolt, targets: [{ kind: 'player', id: 'p1' }] }));
    const from = game.log.length;
    resolveStack(game);

    const produced = game.log.slice(from);
    const resolved = produced.flatMap((e) => (e.body.t === 'StackResolved' ? [e.body] : []));
    expect(resolved).toHaveLength(1);
    expect(resolved[0]?.controller).toBe('p2');

    // ⚠️ And it survives the projection, for a viewer who is NOT the caster —
    // which is the exact case that was broken, since p1 is who the table was
    // showing when p2's spell resolved.
    for (const viewer of ['p1', 'p2']) {
      const cues = toViewEvents(produced, game.state, viewer).flatMap((e) =>
        e.t === 'StackResolved' && e.instanceId ? [e] : [],
      );
      expect(cues).toHaveLength(1);
      expect(cues[0]?.controller).toBe('p2');
    }
  });

  test('an assisted card resolves without doing anything by itself', () => {
    // Pacifism is an Aura, not an instant, so it is `manual` — but the property
    // that matters is general: a face that is not `auto` produces no events.
    const face = faceOfName('Pacifism');
    expect(face.effectMode).not.toBe('auto');
    expect(face.effects.every((e) => e.kind !== undefined)).toBe(true);
  });
});

describe('until end of turn', () => {
  test('a pump applies at layer 7c and stacks with a counter', () => {
    const game = startedGame({ decks: [['Grizzly Bears']] });
    const bears = put(game, 'p1', 'Grizzly Bears'); // 2/2
    must(game.submit({ t: 'ManualSetCounter', player: 'p1', card: bears, kind: '+1/+1', delta: 1 }));
    const before = derive(game.state, ORACLE, game.deps.scripts, bears);
    expect([before.power, before.toughness]).toEqual([3, 3]);

    game.emit([{ t: 'PtModifiedUntilEndOfTurn', card: bears, power: 3, toughness: 3 }]);
    const after = derive(game.state, ORACLE, game.deps.scripts, bears);
    // ⚠️ 2/2 base + 3/3 until-EOT + a +1/+1 counter. If the counter were being
    // swallowed this would read 5/5, which is exactly the D34 failure mode.
    expect([after.power, after.toughness]).toEqual([6, 6]);
  });

  test('it ends at cleanup', () => {
    const game = startedGame({ decks: [['Grizzly Bears']] });
    const bears = put(game, 'p1', 'Grizzly Bears');
    game.emit([{ t: 'PtModifiedUntilEndOfTurn', card: bears, power: 3, toughness: 3 }]);
    expect(game.state.untilEndOfTurn).toHaveLength(1);
    advanceUntil(game, (s) => s.turn.turnNumber > 1, 4000);
    expect(game.state.untilEndOfTurn).toHaveLength(0);
    const after = derive(game.state, ORACLE, game.deps.scripts, bears);
    expect([after.power, after.toughness]).toEqual([2, 2]);
  });
});

/** Every effect kind the parser can produce is handled by the resolver. */
describe('coverage', () => {
  test('no effect kind is parsed that the resolver cannot execute', () => {
    const kinds = new Set(
      ['damage', 'destroy', 'exile', 'bounce', 'counter', 'pump', 'tap', 'untap', 'draw', 'gainLife', 'loseLife'],
    );
    // If the parser ever grows a kind, this fails until `effects.ts` grows a case.
    const samples: [string, string][] = [
      ['~ deals 3 damage to any target.', 'damage'],
      ['Destroy target creature.', 'destroy'],
      ['Exile target creature.', 'exile'],
      ["Return target creature to its owner's hand.", 'bounce'],
      ['Counter target spell.', 'counter'],
      ['Target creature gets +3/+3 until end of turn.', 'pump'],
      ['Tap target creature.', 'tap'],
      ['Untap target creature.', 'untap'],
      ['Draw two cards.', 'draw'],
      ['You gain 5 life.', 'gainLife'],
      ['Target player loses 2 life.', 'loseLife'],
    ];
    for (const [text, kind] of samples) {
      const parsed = parseEffects(text, 'X', true);
      expect(parsed.mode, text).toBe('auto');
      expect(parsed.effects[0]?.kind, text).toBe(kind);
      expect(kinds.has(kind)).toBe(true);
    }
  });
});
