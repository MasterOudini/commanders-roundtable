// CR 708.5 - a face-down card's identity is hidden, and the narration is ONE shared log every seat reads (only its
// controller's own view shows the card). The Tier-3 tools named a face-down permanent through a printed-face fallback
// (it derives no name, CR 708.2) and put its printed colours on the line, so any player could learn a morph by tapping
// it by hand; the stun counter's line read the printed face, and the state-based shield counter and regeneration lines
// carried the printed colours (the leak D583 found in the haunt's line). What is proven here: the OPPONENT works a
// face-down creature with every manual tool that names a permanent - no seat reads its name or its colours, its
// controller included, and only the controller's own view shows the card; a transform, a move to a hidden zone, a move
// that turns a card face down and one out of face-down exile name nothing either; the assisted-effect tool refuses a
// face-down card; a stun counter, a shield counter and a regeneration shield spent on a face-down creature name no card
// and carry no colour; the replay hash on each.
// And the engine's own lines: a face-down permanent derives no name, so every line that printed its derived name read
// " regenerates." - `tableName` names it as the table sees it. Proven: the helper's four answers; a destroy it survives
// by a regeneration shield and by a shield counter, and a shield counter absorbing damage; a fight; an until-end-of-turn
// steal, a control Aura's and its end (lines that also printed "[object Object]" for their player); and a face-down
// creature that DIES is named by its printed face, revealed as it leaves face up (CR 708.9) - never before.
import { describe, expect, test } from 'vitest';
import { ENGINE_CARDS } from '../data/fixtures/engineCards';
import { replay, stateHash } from './log';
import { tableName } from './narrate';
import { project } from './project';
import { createRegistry } from './scripts/registryCore';
import { SUTURE_SPIRIT_SCRIPT } from './scripts/cards/sutureSpirit';
import { advanceUntil, findAnywhere, holdEverywhere, must, ORACLE, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { InstanceId, PlayerId } from './types/ids';

const BEARS = 'Grizzly Bears';
const DELVER = 'Delver of Secrets // Insectile Aberration';
/** An assisted spell whose understood part asks no target and always acts - applied, it would name itself. */
const ASSISTED = ENGINE_CARDS.map((c) => c.name).find((name) => {
  const face = ORACLE.byName(name)?.faces[0];
  return face !== undefined && face.effectMode === 'assisted' && face.targets.length === 0 && face.effects.length > 0 && face.effects.every((e) => e.kind === 'draw' || e.kind === 'gainLife');
});
if (ASSISTED === undefined) throw new Error('no assisted draw-or-gain-life spell among the fixtures');

const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const main = (g: Game, turn: number) => advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
const view = (g: Game, seat: PlayerId) => project(g.state, ORACLE, g.deps.scripts, seat);
/** The newest narration line's id: a test reads the lines after it. */
const mark = (g: Game) => g.state.narration[g.state.narration.length - 1]?.id ?? -1;
/** The canonical lines after `from` - the NDJSON log's own third-person text. */
const said = (g: Game, from: number) => g.state.narration.filter((l) => l.id > from).map((l) => l.text);
/** Every line after `from` as EACH seat reads it - its projected row (second person for its own lines) and colours. */
const rows = (g: Game, from: number) =>
  g.state.seating.flatMap((seat) => view(g, seat).log.filter((e) => e.id > from).map((e) => ({ seat, text: e.text, identity: e.identity })));
/** A card onto its owner's battlefield face down, the way a morph arrives: never named, even as it lands. */
function faceDownOnto(g: Game, player: PlayerId, name: string): InstanceId {
  const card = findAnywhere(g, player, name);
  must(g.submit({ t: 'ManualMoveCard', player, card, to: { kind: 'battlefield', player }, faceDown: true }));
  expect(g.state.cards[card]?.faceDown).toBe(true);
  return card;
}
/** No seat reads any of `names`, and no line carries a colour. */
function namesNothing(g: Game, from: number, names: readonly string[]): void {
  const read = rows(g, from);
  expect(read.length, 'every seat reads the lines').toBeGreaterThan(0);
  for (const r of read) {
    for (const name of names) expect(r.text, `${r.seat} reads "${r.text}"`).not.toContain(name);
    expect(r.identity, `the colours on "${r.text}"`).toEqual([]);
  }
}
/** A blank name leaves a leading space, a double space or a space before a full stop; a part in a plain string, "[object Object]". */
const BROKEN = /^ | {2}| \.|\[object Object\]/;
/** No seat reads a broken line, or any of `hidden`. */
function readsClean(g: Game, from: number, hidden: readonly string[]): void {
  const read = rows(g, from);
  expect(read.length, 'every seat reads the lines').toBeGreaterThan(0);
  for (const r of read) {
    expect(r.text, `${r.seat} reads a broken line`).not.toMatch(BROKEN);
    for (const name of hidden) expect(r.text, `${r.seat} reads "${r.text}"`).not.toContain(name);
  }
}

describe('CR 708.5 - the log never names a face-down card', () => {
  test('the opponent taps it, overrides its P/T, attaches to it and works every other tool on it: no seat reads what it is', () => {
    const g = startedGame({ players: 2, decks: [['Lightning Greaves'], [BEARS]] });
    const greaves = put(g, 'p1', 'Lightning Greaves');
    const from = mark(g);
    const bears = faceDownOnto(g, 'p2', BEARS);
    // p1 - who must never learn what it is - works it with every tool whose line names a permanent.
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [bears], tapped: true }));
    must(g.submit({ t: 'ManualSetPt', player: 'p1', card: bears, power: 4, toughness: 4 }));
    must(g.submit({ t: 'ManualSetPt', player: 'p1', card: bears, power: null, toughness: null }));
    must(g.submit({ t: 'ManualAttach', player: 'p1', card: greaves, to: bears }));
    must(g.submit({ t: 'ManualAttach', player: 'p1', card: bears, to: null }));
    must(g.submit({ t: 'ManualSetCounter', player: 'p1', card: bears, kind: '+1/+1', delta: 1 }));
    must(g.submit({ t: 'ManualSetCommander', player: 'p1', card: bears, isCommander: true }));
    must(g.submit({ t: 'ManualSetCommander', player: 'p1', card: bears, isCommander: false }));
    must(g.submit({ t: 'ManualSetController', player: 'p1', card: bears, controller: 'p2' }));
    expect(said(g, from)).toEqual([
      'Ben moves a card to the battlefield face down.',
      'Ana taps a face-down creature.',
      'Ana sets a face-down creature to 4/4.',
      'Ana clears the power/toughness override on a face-down creature.',
      'Ana attaches Lightning Greaves to a face-down creature.',
      'Ana unattaches a face-down creature.',
      'Ana adds 1 +1/+1 counter to a face-down creature.',
      'Ana makes a face-down creature a commander.',
      'Ana stops treating a face-down creature as a commander.',
      'Ana gives control of a face-down creature to Ben.',
    ]);
    namesNothing(g, from, [BEARS]);
    // Only its controller's own view shows the card - and the log in it is the shared one, which never did.
    expect(view(g, 'p2').cards[bears]?.card?.name).toBe(BEARS);
    expect(JSON.stringify(view(g, 'p1')), "nothing in the opponent's view names it").not.toContain(BEARS);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a transform, a move to a hidden zone, a face-down exile and a move out of it name nothing; the assisted tool refuses a face-down card', () => {
    const g = startedGame({ players: 2, decks: [[], [DELVER, ASSISTED]] });
    const from = mark(g);
    const delver = faceDownOnto(g, 'p2', DELVER);
    must(g.submit({ t: 'ManualFlipFace', player: 'p1', card: delver }));
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: delver, to: { kind: 'hand', player: 'p2' } }));
    // p2 exiles a spell face down (a foretell's shape); p1 can neither name it by moving it nor apply its text.
    const spell = findAnywhere(g, 'p2', ASSISTED);
    must(g.submit({ t: 'ManualMoveCard', player: 'p2', card: spell, to: { kind: 'exile', player: 'p2' }, faceDown: true }));
    expect(g.state.cards[spell]?.faceDown).toBe(true);
    const applied = g.submit({ t: 'ManualApplyEffect', player: 'p1', card: spell, targets: [] });
    expect(applied.ok, 'a face-down card has no text to apply (CR 708.2)').toBe(false);
    if (!applied.ok) expect(applied.reason).toBe('notCastable');
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: spell, to: { kind: 'hand', player: 'p2' } }));
    expect(said(g, from)).toEqual([
      'Ben moves a card to the battlefield face down.',
      'Ana transforms a face-down creature.',
      'Ana moves a face-down creature to their hand.',
      'Ben moves a card to exile face down.',
      'Ana moves a face-down card to their hand.',
    ]);
    namesNothing(g, from, ['Delver of Secrets', 'Insectile Aberration', ASSISTED]);
    expect(JSON.stringify(view(g, 'p1')), "nothing in the opponent's view names either").not.toMatch(/Delver of Secrets|Insectile Aberration/);
    expect(JSON.stringify(view(g, 'p1'))).not.toContain(ASSISTED);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a stun counter spent on a face-down creature names no card (CR 122.1j)', () => {
    const g = startedGame({ players: 2, decks: [[BEARS], []], scripts: createRegistry([]) });
    holdEverywhere(g);
    const from = mark(g);
    const bears = faceDownOnto(g, 'p1', BEARS);
    must(g.submit({ t: 'ManualSetTapped', player: 'p2', cards: [bears], tapped: true }));
    must(g.submit({ t: 'ManualSetCounter', player: 'p2', card: bears, kind: 'stun', delta: 1 }));
    main(g, 3);
    expect([g.state.cards[bears]?.tapped, g.state.cards[bears]?.counters['stun'] ?? 0], 'the untap spent the counter').toEqual([true, 0]);
    expect(said(g, from)).toContain('A face-down creature stays tapped: a stun counter is removed instead.');
    namesNothing(g, from, [BEARS]);
    expect(JSON.stringify(view(g, 'p2'))).not.toContain(BEARS);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a regeneration shield spent on a face-down creature names no card and carries no colour (CR 701.19)', () => {
    const g = startedGame({ players: 2, decks: [['Suture Spirit', 'Lightning Bolt'], [BEARS]], scripts: createRegistry([SUTURE_SPIRIT_SCRIPT]) });
    holdEverywhere(g);
    main(g, 1);
    const spirit = put(g, 'p1', 'Suture Spirit');
    const bolt = put(g, 'p1', 'Lightning Bolt', 'hand');
    settle(g);
    const from = mark(g);
    const bears = faceDownOnto(g, 'p2', BEARS);
    settle(g);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 3 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: spirit, abilityIndex: 0 }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.regenerationShields[bears]).toBe(1);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bolt, targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect([g.state.cards[bears]?.zone.kind, g.state.cards[bears]?.damage, g.state.regenerationShields[bears] ?? 0], 'regenerated, not destroyed').toEqual(['battlefield', 0, 0]);
    expect(said(g, from)).toContain('A face-down creature regenerates.');
    const line = g.state.narration.find((l) => l.id > from && l.text.includes('regenerates'));
    expect(line?.identity, "no printed colour on the line's bar").toEqual([]);
    for (const r of rows(g, from)) expect(r.text, `${r.seat} reads "${r.text}"`).not.toContain(BEARS);
    expect(JSON.stringify(view(g, 'p1'))).not.toContain(BEARS);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a shield counter spent in place of a destruction on a face-down creature names no card and carries no colour (CR 122.1i)', () => {
    const g = startedGame({ players: 2, decks: [['Lightning Bolt'], [BEARS]] });
    holdEverywhere(g);
    main(g, 1);
    const bolt = put(g, 'p1', 'Lightning Bolt', 'hand');
    const from = mark(g);
    const bears = faceDownOnto(g, 'p2', BEARS);
    settle(g);
    // Damage it survives as a 5/5, then a shield counter, then the 2/2 again: lethal damage the counter answers (D469).
    must(g.submit({ t: 'ManualSetPt', player: 'p2', card: bears, power: 5, toughness: 5 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bolt, targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[bears]?.damage).toBe(3);
    must(g.submit({ t: 'ManualSetCounter', player: 'p2', card: bears, kind: 'shield', delta: 1 }));
    must(g.submit({ t: 'ManualSetPt', player: 'p2', card: bears, power: null, toughness: null }));
    settle(g);
    const line = g.state.narration.find((l) => l.id > from && l.text.startsWith('A shield counter on'));
    expect(line?.text).toBe('A shield counter on a face-down creature is removed instead.');
    expect(line?.identity, "no printed colour on the line's bar").toEqual([]);
    // The damage stays marked, so the next pass destroys it - REVEALED as it leaves face up (CR 708.9): the dies line
    // names what died by its printed face, and it is the first line that names it at all.
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    const lines = said(g, from);
    const died = lines.indexOf(`${BEARS} dies.`);
    expect(died, 'the dies line names it by its printed face').toBeGreaterThan(-1);
    expect(lines.slice(0, died).filter((t) => t.includes(BEARS)), 'and no line before it does').toEqual([]);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

describe('the table name - a face-down permanent is never a blank in the engine lines', () => {
  const ANGEL = 'Serra Angel';

  test('the helper: a face-down creature, a face-down permanent, a face-down card, else the derived name', () => {
    const creature = { name: '', isCreature: true };
    const onField = { faceDown: true, zone: { kind: 'battlefield', player: 'p1' } } as const;
    expect(tableName(onField, creature)).toBe('a face-down creature');
    expect(tableName(onField, creature, true)).toBe('A face-down creature');
    expect(tableName(onField, { name: '', isCreature: false })).toBe('a face-down permanent');
    expect(tableName({ faceDown: true, zone: { kind: 'exile', player: 'p1' } }, { name: ANGEL, isCreature: true }), 'no printed name off the battlefield either').toBe('a face-down card');
    expect(tableName({ faceDown: false, zone: { kind: 'battlefield', player: 'p1' } }, { name: ANGEL, isCreature: true }, true)).toBe(ANGEL);
    expect(tableName(undefined, { name: ANGEL, isCreature: true })).toBe(ANGEL);
  });

  test('a destroy it survives - a regeneration shield, then a shield counter - and a shield counter absorbing damage', () => {
    const g = startedGame({ players: 2, decks: [['Suture Spirit', 'Murder', 'Doom Blade', 'Lightning Bolt'], [ANGEL]], scripts: createRegistry([SUTURE_SPIRIT_SCRIPT]) });
    holdEverywhere(g);
    main(g, 1);
    const spirit = put(g, 'p1', 'Suture Spirit');
    const murder = put(g, 'p1', 'Murder', 'hand');
    const blade = put(g, 'p1', 'Doom Blade', 'hand');
    const bolt = put(g, 'p1', 'Lightning Bolt', 'hand');
    settle(g);
    const from = mark(g);
    const angel = faceDownOnto(g, 'p2', ANGEL);
    const cast = (card: InstanceId, symbol: 'B' | 'R', amount: number) => {
      must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol, amount }));
      must(g.submit({ t: 'CastSpell', player: 'p1', card, targets: [{ kind: 'card', id: angel }] }));
      settle(g);
    };
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 3 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: spirit, abilityIndex: 0 }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: angel }] }));
    settle(g);
    cast(murder, 'B', 3);
    must(g.submit({ t: 'ManualSetCounter', player: 'p2', card: angel, kind: 'shield', delta: 1 }));
    cast(blade, 'B', 2);
    must(g.submit({ t: 'ManualSetCounter', player: 'p2', card: angel, kind: 'shield', delta: 1 }));
    cast(bolt, 'R', 1);
    expect([g.state.cards[angel]?.zone.kind, g.state.cards[angel]?.faceDown, g.state.cards[angel]?.damage], 'it survived all three, face down').toEqual(['battlefield', true, 0]);
    const lines = said(g, from);
    expect(lines).toContain('A face-down creature regenerates.');
    expect(lines).toContain('A shield counter on a face-down creature is removed instead.');
    expect(lines).toContain('A shield counter on a face-down creature absorbs the damage.');
    readsClean(g, from, [ANGEL]);
    expect(JSON.stringify(view(g, 'p1')), "nothing in the opponent's view names it").not.toContain(ANGEL);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a fight names a face-down creature', () => {
    const g = startedGame({ players: 2, decks: [['Llanowar Elves', 'Prey Upon'], [ANGEL]] });
    holdEverywhere(g);
    main(g, 1);
    const elves = put(g, 'p1', 'Llanowar Elves');
    const prey = put(g, 'p1', 'Prey Upon', 'hand');
    settle(g);
    const from = mark(g);
    const angel = faceDownOnto(g, 'p2', ANGEL);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: prey, targets: [{ kind: 'card', id: elves }, { kind: 'card', id: angel }] }));
    settle(g);
    // The 1/1 deals 1 and takes 2: the Elves die, the face-down 2/2 lives with its damage.
    expect([g.state.cards[elves]?.zone.kind, g.state.cards[angel]?.zone.kind, g.state.cards[angel]?.damage]).toEqual(['graveyard', 'battlefield', 1]);
    expect(said(g, from)).toContain('Llanowar Elves fights a face-down creature.');
    readsClean(g, from, [ANGEL]);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('control changes name a face-down creature: an until-end-of-turn steal, a control Aura, and its end', () => {
    const g = startedGame({ players: 2, decks: [['Act of Treason', 'Mind Control'], [ANGEL, BEARS]] });
    holdEverywhere(g);
    main(g, 1);
    const treason = put(g, 'p1', 'Act of Treason', 'hand');
    const aura = put(g, 'p1', 'Mind Control', 'hand');
    settle(g);
    const from = mark(g);
    const angel = faceDownOnto(g, 'p2', ANGEL);
    const bears = faceDownOnto(g, 'p2', BEARS);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 3 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: treason, targets: [{ kind: 'card', id: angel }] }));
    settle(g);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 5 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: aura, targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect([g.state.cards[angel]?.controller, g.state.cards[bears]?.controller], 'both taken').toEqual(['p1', 'p1']);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: aura, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(g.state.cards[bears]?.controller, 'the Aura gone, the creature goes back').toBe('p2');
    const lines = said(g, from);
    expect(lines).toContain('Act of Treason: a face-down creature changes control until end of turn.');
    // The two state-based lines built a player part into a plain string: "[object Object] [object Object] control of ."
    expect(lines).toContain('Ana takes control of a face-down creature.');
    expect(lines).toContain('A face-down creature goes back to Ben.');
    // The seat those lines are about reads them in the second person.
    expect(view(g, 'p1').log.map((e) => e.text)).toContain('You take control of a face-down creature.');
    expect(view(g, 'p2').log.map((e) => e.text)).toContain('A face-down creature goes back to you.');
    readsClean(g, from, [ANGEL, BEARS]);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
