// D356 — PROTECTION FROM SOMETHING THAT IS NOT A COLOUR.
//
// `Protection` carried `colors` and `fromEverything` and dumped every other word into `other`,
// verbatim and UNENFORCED — so `engineComplete` refused any line naming one, correctly, because
// the engine would have let the bot be blocked by, or target, a thing the card says it cannot be.
// That is D90 working. This decision reads those words instead: a card TYPE, a SUBTYPE and a
// COLOUR CATEGORY are all decidable from facts the enforced half already had.
//
// What is proven here, in the order the quality travels:
//   · the PARSER classifies each printed quality into a field the engine consults, and leaves in
//     `other` the one wording it cannot decide — which keeps its card INCOMPLETE;
//   · the PREDICATE answers the CR 702.16b question once, for every site, including the plural a
//     card prints against the singular the engine stores;
//   · the RULE is enforced at all four sites the engine has — a block, damage, an aim and the Aura
//     fall-off — because a quality honoured when a creature blocks and not when it is targeted is
//     not a rule at all;
//   · the ACCOUNTING claims the line, which is the whole coverage move.
import { describe, expect, test } from 'vitest';
import { faceOf } from './oracle';
import { protectedFrom, protectionFullyRead } from './protection';
import { engineCompleteness } from '../data/engineComplete';
import { createRegistry } from './scripts/registryCore';
import { ICY_MANIPULATOR_SCRIPT } from './scripts/cards/icyManipulator';
import { advanceUntil, holdEverywhere, must, ORACLE, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { ParsedTypeLine } from './types/oracle';

function face(name: string) {
  const card = ORACLE.byName(name);
  if (!card) throw new Error(`no fixture ${name}`);
  return faceOf(card, 0);
}
function prot(name: string) {
  return face(name).protection;
}
function data(name: string) {
  const card = ORACLE.byName(name);
  if (!card) throw new Error(`no fixture ${name}`);
  return card.data;
}
function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}
function typeLine(name: string): ParsedTypeLine {
  return face(name).typeLine;
}

describe('protection from a quality that is not a colour (D356)', () => {
  // ── the parse ──────────────────────────────────────────────────────────────
  test('a card TYPE is read into `types`, and nothing is left over', () => {
    const p = prot('Beloved Chaplain'); // `Protection from creatures`
    expect(p.types).toEqual(['Creature']);
    expect(p.other).toEqual([]);
    expect(protectionFullyRead(p)).toBe(true);
  });

  test('a SEMICOLON separates the protection from the keyword beside it', () => {
    // `Protection from artifacts; reach` — the clause stops at the semicolon, and the LINE is a
    // keyword list printed with the other punctuation.
    const p = prot('Tel-Jilad Archers');
    expect(p.types).toEqual(['Artifact']);
    expect(p.other).toEqual([]);
    expect(engineCompleteness(data('Tel-Jilad Archers')).complete).toBe(true);
  });

  test('two SUBTYPES joined by `and from` are read as printed', () => {
    const p = prot('Baneslayer Angel'); // `...protection from Demons and from Dragons`
    expect(p.subtypes).toEqual(['Demons', 'Dragons']);
    expect(p.other).toEqual([]);
  });

  test('a COMMA-separated list repeats the preposition, and every member is read', () => {
    // `Protection from Vampires, from Werewolves, and from Zombies` — the splitter cuts on the
    // comma and hands the next part over with its own `from` still attached. Before D356 that part
    // matched no table, failed the single-plain-word subtype test, and went to `other` unenforced.
    const p = prot('Elite Inquisitor');
    expect(p.subtypes).toEqual(['Vampires', 'Werewolves', 'Zombies']);
    expect(p.other).toEqual([]);
  });

  test('the same list of COLOURS reads as colours', () => {
    const p = prot('Oversoul of Dusk'); // `Protection from blue, from black, and from red`
    expect(p.colors).toEqual(['U', 'B', 'R']);
    expect(p.subtypes ?? []).toEqual([]);
    expect(p.other).toEqual([]);
  });

  test('a COLOUR CATEGORY is its own field, both ways round', () => {
    expect(prot('Guardian of the Guildpact').categories).toEqual(['monocolored']);
    expect(prot('Enemy of the Guildpact').categories).toEqual(['multicolored']);
  });

  test('`each color` is every colour, the set `all colors` already meant', () => {
    expect(prot('Iridescent Angel').colors).toEqual(['W', 'U', 'B', 'R', 'G']);
  });

  // ── the boundary ───────────────────────────────────────────────────────────
  test('a QUALIFIED noun stays in `other`, and its card stays INCOMPLETE', () => {
    // `protection from spells that are one or more colors` (16 printings). The engine has no way to
    // ask "is this source a spell that is one or more colors" of a permanent's characteristics, so
    // the words stay verbatim and unenforced — and the card stays refused, which is the whole
    // reason `other` exists. A later widening that quietly claimed this line would fail here.
    const p = prot('Emrakul, the Aeons Torn');
    expect(p.other.length).toBeGreaterThan(0);
    expect(protectionFullyRead(p)).toBe(false);
    expect(engineCompleteness(data('Emrakul, the Aeons Torn')).complete).toBe(false);
  });

  // ── the predicate ──────────────────────────────────────────────────────────
  test('a printed PLURAL matches the singular the engine stores', () => {
    // ⚠️ MATCHED, NOT DERIVED. `Elves` against the subtype `Elf` and `Werewolves` against
    // `Werewolf` both break a rule that appends an `s`, and a protection that silently fails to
    // match is worse than one that is honestly unenforced.
    const buffoon = prot("Nath's Buffoon"); // `Protection from Elves`
    expect(protectedFrom(buffoon, { colors: ['G'], typeLine: typeLine('Llanowar Elves') })).toBe(true);
    expect(protectedFrom(buffoon, { colors: ['G'], typeLine: typeLine('Grizzly Bears') })).toBe(false);
  });

  test('a CATEGORY is decided from the source\'s colour count', () => {
    const mono = prot('Guardian of the Guildpact');
    const multi = prot('Enemy of the Guildpact');
    expect(protectedFrom(mono, { colors: ['R'] })).toBe(true);
    expect(protectedFrom(mono, { colors: ['R', 'W'] })).toBe(false);
    expect(protectedFrom(mono, { colors: [] })).toBe(false);
    expect(protectedFrom(multi, { colors: ['R', 'W'] })).toBe(true);
    expect(protectedFrom(multi, { colors: ['R'] })).toBe(false);
  });

  test('a TYPE is decided from the source\'s type line, and absence is not "no types"', () => {
    const savage = prot('Nacatl Savage'); // `Protection from artifacts`
    expect(protectedFrom(savage, { colors: [], typeLine: typeLine('Metallic Sliver') })).toBe(true);
    expect(protectedFrom(savage, { colors: ['G'], typeLine: typeLine('Grizzly Bears') })).toBe(false);
    // ⚠️ A caller with no type line gets the colour and category answers and NO type answer — the
    // same coverage the engine had before this file, never a false positive either way.
    expect(protectedFrom(savage, { colors: [] })).toBe(false);
  });

  // ── the rule, at the sites that have to agree ──────────────────────────────
  test('it cannot be BLOCKED by a source with the quality (CR 702.16e)', () => {
    const g = startedGame({ players: 2, decks: [['Nacatl Savage'], ['Metallic Sliver', 'Grizzly Bears']] });
    holdEverywhere(g);
    const sliver = put(g, 'p2', 'Metallic Sliver');
    const bears = put(g, 'p2', 'Grizzly Bears');
    settle(g);
    const savage = put(g, 'p1', 'Nacatl Savage');
    settle(g);
    advanceUntil(
      g,
      (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers' && s.priority.awaiting.player === 'p1',
      40_000,
    );
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: savage, defender: { kind: 'player', id: 'p2' } }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareBlockers', 20_000);
    // The artifact creature is refused; the ordinary one is accepted on the same board.
    expect(g.submit({ t: 'DeclareBlockers', player: 'p2', blocks: [{ blocker: sliver, attacker: savage }] }).ok).toBe(false);
    must(g.submit({ t: 'DeclareBlockers', player: 'p2', blocks: [{ blocker: bears, attacker: savage }] }));
  });

  test('it cannot be DAMAGED by a source with the quality', () => {
    // The protected creature BLOCKS the artifact — protection stops it being blocked BY one, never
    // the other way round — so the artifact's combat damage is the thing under test.
    const g = startedGame({ players: 2, decks: [['Tel-Jilad Archers'], ['Metallic Sliver']] });
    holdEverywhere(g);
    const archers = put(g, 'p1', 'Tel-Jilad Archers');
    settle(g);
    const sliver = put(g, 'p2', 'Metallic Sliver');
    settle(g);
    advanceUntil(
      g,
      (s) => s.turn.turnNumber === 4 && s.priority.awaiting?.kind === 'declareAttackers' && s.priority.awaiting.player === 'p2',
      60_000,
    );
    must(g.submit({ t: 'DeclareAttackers', player: 'p2', attackers: [{ card: sliver, defender: { kind: 'player', id: 'p1' } }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareBlockers', 20_000);
    must(g.submit({ t: 'DeclareBlockers', player: 'p1', blocks: [{ blocker: archers, attacker: sliver }] }));
    advanceUntil(g, (s) => s.turn.step === 'postcombatMain', 40_000);
    // The Sliver is dead (the Archers' 2 damage landed); the Archers took nothing at all.
    expect(g.state.cards[archers]?.damage ?? 0).toBe(0);
    expect(g.state.cards[sliver]?.zone.kind).toBe('graveyard');
  });

  test('it cannot be TARGETED by a source with the quality', () => {
    const g = startedGame({
      players: 2,
      decks: [['Icy Manipulator', 'Nacatl Savage', 'Grizzly Bears'], ['Island']],
      scripts: createRegistry([ICY_MANIPULATOR_SCRIPT]),
    });
    holdEverywhere(g);
    // All three on p1's own board: protection asks what the SOURCE is, never who controls it.
    const icy = put(g, 'p1', 'Icy Manipulator');
    const savage = put(g, 'p1', 'Nacatl Savage');
    const bears = put(g, 'p1', 'Grizzly Bears');
    settle(g);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: icy, abilityIndex: 0 }));
    // The Icy is an ARTIFACT source, so the protected creature is not a legal choice — and the
    // creature beside it, with no protection, is.
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: savage }] }).ok).toBe(false);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[bears]?.tapped).toBe(true);
    expect(g.state.cards[savage]?.tapped ?? false).toBe(false);
  });

  test('an AURA cannot be cast onto it (CR 702.16b — enchanted)', () => {
    // `Azorius First-Wing` has protection from enchantments; `Pacifism` is an enchantment spell, so
    // the aim refuses it and takes the ordinary creature beside it.
    const g = startedGame({ players: 2, decks: [['Pacifism', 'Plains', 'Grizzly Bears'], ['Azorius First-Wing']] });
    holdEverywhere(g);
    const wing = put(g, 'p2', 'Azorius First-Wing');
    const bears = put(g, 'p1', 'Grizzly Bears');
    settle(g);
    const pacifism = put(g, 'p1', 'Pacifism', 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: pacifism }));
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: wing }] }).ok).toBe(false);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  });

  // ── the accounting ─────────────────────────────────────────────────────────
  test('every carrier the seam reads is COMPLETE, and it is the whole coverage move', () => {
    for (const name of [
      'Beloved Chaplain',
      'Baneslayer Angel',
      'Elite Inquisitor',
      'Oversoul of Dusk',
      'Guardian of the Guildpact',
      'Enemy of the Guildpact',
      'Iridescent Angel',
      "Nath's Buffoon",
      'Azorius First-Wing',
      'Nacatl Savage',
    ]) {
      expect(engineCompleteness(data(name)).complete, name).toBe(true);
    }
  });
});

/** A protection whose only claim is an empty `other` claims nothing. */
describe('protectionFullyRead', () => {
  test('nothing read is not "fully read"', () => {
    expect(protectionFullyRead({ colors: [], fromEverything: false, other: [] })).toBe(false);
    expect(protectionFullyRead({ colors: [], fromEverything: false, types: ['Artifact'], other: [] })).toBe(true);
    expect(protectionFullyRead({ colors: ['W'], fromEverything: false, other: ['the chosen color'] })).toBe(false);
  });
});
