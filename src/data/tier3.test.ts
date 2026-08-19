import { describe, expect, test } from 'vitest';
import { tier3NotesFor, tier3SummaryFor } from './tier3';
import * as C from './fixtures/engineCards';
import type { CardData } from './cardTypes';

// ⚠️ The fixtures carry VERBATIM oracle text (D15b), so these tests are about
// the real wording rather than about a paraphrase that would keep passing after
// Scryfall reworded something.

const what = (card: CardData, faceIndex = 0): string[] =>
  tier3NotesFor(card, faceIndex).map((n) => n.what);

describe('tier3NotesFor', () => {
  /**
   * ⚠️ THE MOST IMPORTANT CASE. A card the engine handles completely must say
   * NOTHING. A disclosure that appears on every card is furniture within a
   * minute, and then the one card that genuinely needed it is not read either.
   */
  test('a card the engine fully handles produces no notes', () => {
    expect(tier3NotesFor(C.GRIZZLY_BEARS)).toEqual([]);
    expect(tier3NotesFor(C.FOREST)).toEqual([]);
    expect(tier3SummaryFor(C.GRIZZLY_BEARS)).toBeNull();
    // ⚠️ The shapes D122 taught this file to talk about, on cards where the app
    // really does do the whole job: a mana ability IS run, so `Sol Ring` must not
    // pick up an activated-ability note, and a reminder-text-only line is not a
    // static ability the app is ignoring.
    expect(tier3NotesFor(C.SOL_RING)).toEqual([]);
    expect(tier3NotesFor(C.ARCANE_SIGNET)).toEqual([]);
    expect(tier3NotesFor(C.DRYAD_ARBOR)).toEqual([]);
  });

  test('an automated keyword produces no note', () => {
    // Flying, vigilance, first strike and the rest are enforced, so saying
    // anything about them would be a lie in the other direction.
    expect(tier3NotesFor(C.SERRA_ANGEL)).toEqual([]);
    expect(tier3NotesFor(C.VAMPIRE_NIGHTHAWK)).toEqual([]);
  });

  /**
   * ⚠️ Protection is PARTLY enforced, which is the hardest case to describe
   * honestly. "Protection is not automatic" would be false; saying nothing lets
   * a player assume `protection from creatures` is being checked. Name the
   * clause that is not enforced, and stay quiet about the one that is.
   */
  test('protection from a COLOUR is enforced, so it is not mentioned', () => {
    // Kor Firewalker: "Protection from red" — enforced, so no protection note.
    // ⚠️ Its SECOND line is "Whenever a player casts a red spell, you may gain 1
    // life.", which nothing runs, so the card is not silent — it is silent about
    // the protection. This test read `[]` until D122 and that was the gap: the
    // trigger went unmentioned on a card the panel then looked settled about.
    expect(what(C.KOR_FIREWALKER)).toEqual(['Its ability text']);
    expect(what(C.KOR_FIREWALKER)).not.toContain('Protection from red');
  });

  test('protection from a non-colour IS mentioned, with the clause', () => {
    const card = withText(C.GRIZZLY_BEARS, 'Protection from creatures', ['Protection']);
    expect(what(card)).toEqual(['Protection from creatures']);
  });

  test('a multi-colour protection clause is still enforced and stays quiet', () => {
    const card = withText(C.GRIZZLY_BEARS, 'Protection from black and from red', ['Protection']);
    expect(what(card)).toEqual([]);
  });

  test('an enforced ward is not mentioned; a decision ward is', () => {
    // Ward {4} and Ward—Pay N life are charged (D68), so they stay quiet.
    expect(what(withText(C.GRIZZLY_BEARS, 'Ward {2}', ['Ward']))).toEqual([]);
    expect(what(withText(C.GRIZZLY_BEARS, 'Ward—Pay 3 life.', ['Ward']))).toEqual([]);
    expect(what(withText(C.GRIZZLY_BEARS, 'Ward—Discard a card.', ['Ward']))).toEqual(['Ward']);
  });

  test('a mana ability the solver cannot model is named', () => {
    // Bloom Tender: "Add one mana of any color your commanders could produce" —
    // a board-dependent amount, so it stays manually tappable.
    expect(what(C.BLOOM_TENDER).length).toBeGreaterThan(0);
    expect(what(C.BLOOM_TENDER)).toContain('Its mana ability');
  });

  test('a plain land keeps quiet about its mana', () => {
    expect(what(C.TUNDRA)).toEqual([]);
    expect(what(C.COMMAND_TOWER)).toEqual([]);
  });

  test('an unautomated keyword worth naming is named with what to do instead', () => {
    const card = { ...C.GRIZZLY_BEARS, keywords: ['Crew'] };
    const notes = tier3NotesFor(card);
    expect(notes).toHaveLength(1);
    expect(notes[0]?.what).toBe('Crew');
    // ⚠️ The note says what the PLAYER does, not what the card does. Explaining
    // the card would be a second rules text that drifts from Scryfall's.
    expect(notes[0]?.how).toContain('yourself');
  });

  test('an unautomated keyword NOT on the short list stays quiet', () => {
    // 885 distinct keyword strings exist; naming all of them would be a wall of
    // text nobody reads, which is the same outcome as saying nothing.
    const card = { ...C.GRIZZLY_BEARS, keywords: ['Sonic Rainboom'] };
    expect(tier3NotesFor(card)).toEqual([]);
  });

  test('a note is never repeated', () => {
    const card = { ...C.GRIZZLY_BEARS, keywords: ['Crew', 'Crew'] };
    expect(tier3NotesFor(card)).toHaveLength(1);
  });
});

/**
 * ⚠️ THE TWO GAPS D121 REPORTED AND D122 CLOSED, and the reason they were worth
 * closing is in the first test below: every one of these cards ships in a starter
 * deck today, and every one of them said NOTHING — which the hover panel renders
 * exactly as it renders a vanilla creature the app runs in full.
 *
 * Nothing about the ENGINE changed. `engineComplete.ts` already refused all four
 * for the bot's deck; these are notes, not rules.
 */
describe('a permanent’s text, which the app does not run', () => {
  test('three starter commanders still say so — and Talrand no longer needs to', () => {
    // Kess's and Yeva's whole cards are static; Krenko's is an activated
    // ability the engine charges and does not run. ⚠️ Talrand was the fourth
    // from D122 until his script SHIPPED in M6.4c (D160) — a Drake for every
    // instant or sorcery, for real — so his silence is invariant 9's other
    // direction: a card the engine runs completely must say nothing.
    expect(what(C.TALRAND_SKY_SUMMONER)).toEqual([]);
    expect(what(C.KESS_DISSIDENT_MAGE)).toEqual(['Its ability text']);
    expect(what(C.YEVA_NATURE_S_HERALD)).toEqual(['Its ability text']);
    expect(what(C.KRENKO_MOB_BOSS)).toEqual(['Its “{T}” ability']);
  });

  test('an enters-the-battlefield trigger is said — until a script SHIPS for it', () => {
    // ⚠️ M6.4a (D158): Wall of Omens and Baleful Strix were this test's
    // examples of "nothing runs it" from D122 until their scripts shipped —
    // now their notes are SILENT, which is the silence hook keeping invariant
    // 9's other direction: a card the engine runs completely must say nothing.
    // Boros Garrison carries the same shape with no script, so the note it
    // still shows is what the two used to.
    expect(what(C.WALL_OF_OMENS)).toEqual([]);
    expect(what(C.BALEFUL_STRIX)).toEqual([]);
    expect(what(C.BOROS_GARRISON)).toContain('Its ability text');
  });

  test('a static ability is said even when it grants an ENFORCED keyword', () => {
    // ⚠️ Avacyn's own flying/vigilance/indestructible are enforced; the
    // indestructible she gives every other permanent is not (D82 — a granted
    // keyword needs a layer-6 script). Quiet about the first, loud about the
    // second, on the same card.
    expect(what(C.AVACYN_ANGEL_OF_HOPE)).toEqual(['Its ability text']);
    // Lightning Greaves grants haste and shroud to the equipped creature, and
    // `Equip {0}` is the keyword loop's business.
    expect(what(C.LIGHTNING_GREAVES)).toEqual(['Its ability text', 'Equip']);
  });

  test('an Aura’s restriction is said; its Enchant clause stays the keyword loop’s', () => {
    expect(what(C.PACIFISM)).toEqual(['Its ability text', 'Enchant']);
  });

  test('a replacement effect on a permanent is said', () => {
    // Mox Diamond: the discard-a-land replacement is unrun, the mana ability runs.
    expect(what(C.MOX_DIAMOND)).toEqual(['Its ability text']);
  });

  /**
   * ⚠️ A KEYWORD LINE IS NOT A STATIC ABILITY, and this is the case that decided
   * where the boundary goes. `Partner` and `Scry` are Tier 3, `Partner` is in fact
   * enforced by the deck validator, and D68 decided the 885-string keyword tail is
   * named from a short list rather than in full. Reporting a bare keyword line as
   * "ability text the app does not run" would have re-opened that decision on
   * thousands of cards and told a player something false about Partner.
   */
  test('a bare keyword line raises no ability-text note', () => {
    expect(what(C.THRASIOS_TRITON_HERO)).toEqual(['Its “{4}” ability']);
    expect(what(C.SHORIKAI_GENESIS_ENGINE)).toEqual(['Its “{1}, {T}” ability', 'Crew']);
    // A ward that is a decision is named as a ward, once, and not twice.
    expect(what(withText(C.GRIZZLY_BEARS, 'Ward—Discard a card.', ['Ward']))).toEqual(['Ward']);
  });

  /**
   * ⚠️ AN ABILITY WORD IS NOT A KEYWORD LINE, and Scryfall's own data is what
   * makes this the trap it is: `Magecraft` is listed in Sedgemoor Witch's
   * `keywords`, so the line "Magecraft — Whenever you cast or copy an instant or
   * sorcery spell, create a 1/1 …" OPENS with a printed keyword while being a
   * whole triggered ability. Reading the clause after the comma is what tells the
   * two apart — see `isPrintedKeywordLine`.
   */
  test('an ability-word trigger is said, and the ward and menace beside it are not', () => {
    // Menace is enforced; `Ward—Pay 3 life` is charged (D68); the magecraft
    // trigger is not run, and it is the only thing this card says.
    expect(what(C.SEDGEMOOR_WITCH)).toEqual(['Its ability text']);
  });

  test('a payable ability says the cost is charged and the effect is not', () => {
    const note = tier3NotesFor(C.KRENKO_MOB_BOSS)[0];
    expect(note?.what).toBe('Its “{T}” ability');
    // ⚠️ BOTH HALVES, because either alone misleads: "not automatic" would not
    // warn that tapping him is still charged, and "the app charges it" would not
    // say that nothing follows.
    expect(note?.how).toContain('charges that cost');
    expect(note?.how).toContain('nothing happens');
  });

  test('a loyalty ability is unchanged, and its static line is now said too', () => {
    // Grist is a static line ("As long as Grist isn't on the battlefield…") plus
    // three loyalty abilities, which have been named since M5 and still are.
    expect(what(C.GRIST_THE_HUNGER_TIDE)).toEqual(['Its ability text', 'Its loyalty abilities']);
  });

  test('the spell path is untouched', () => {
    // ⚠️ A regression guard rather than a new claim: `auto` stays silent,
    // `assisted` still offers its half, and a manual spell still owns "Its
    // effect". D122 added a branch for permanents alone.
    // ⚠️ Swords to Plowshares held the `assisted` post until it SHIPPED
    // (D196) and is silent now; Read the Bones took over — the ask-not-last
    // guard's own child (D195): scry-then-draw is understood, and the life
    // loss AFTER the ask keeps it honestly assisted.
    expect(what(C.LIGHTNING_BOLT)).toEqual([]);
    expect(what(C.COUNTERSPELL)).toEqual([]);
    expect(what(C.SWORDS_TO_PLOWSHARES)).toEqual([]);
    expect(what(C.READ_THE_BONES)).toEqual(['Part of its effect']);
    expect(what(C.CULTIVATE)).toEqual(['Its effect']);
  });

  /**
   * ⚠️ THE ONE PLACE THE APP DOES PART OF A LINE AND CARRIES ON (D124), which is
   * why this needs words of its own rather than either note above. `tapForMana`
   * taps the permanent and adds the mana, and does nothing else on that line — no
   * cost beyond the tap, no activation condition, no once-per-turn limit, no
   * second sentence.
   */
  test('a mana line that does MORE than add mana says the rest is yours', () => {
    // Ancient Tomb: `{T}: Add {C}{C}. This land deals 2 damage to you.` — one
    // line, and the app does exactly the first half of it. Silent until D124.
    expect(what(C.ANCIENT_TOMB)).toEqual(['Part of its mana ability']);
  });

  test('a cost beyond {T}, and a spend restriction, are the same note', () => {
    // Gemstone Mine pays with a counter the app never removes; Cavern of Souls'
    // second ability restricts what its mana may be spent on. Both are reasons
    // `ManaProduction.conditional` is set, and the flag does not say which — so
    // one note names all of them.
    expect(what(C.GEMSTONE_MINE)).toEqual(['Its ability text', 'Part of its mana ability']);
    expect(what(C.CAVERN_OF_SOULS)).toEqual(['Its ability text', 'Part of its mana ability']);
  });

  test('a mana line the engine models COMPLETELY stays quiet', () => {
    // ⚠️ The direction that matters. Boros Garrison's `{T}: Add {R}{W}` and Mox
    // Diamond's `{T}: Add one mana of any color` are run in full — the notes on
    // those two cards are for their other lines, and a mana note here would send a
    // player to tap something the app taps for them.
    expect(what(C.BOROS_GARRISON)).toEqual(['Its ability text']);
    expect(what(C.MOX_DIAMOND)).toEqual(['Its ability text']);
    // D116's board-resolved scopes are deliberately NOT conditional, because the
    // engine knows both sets exactly.
    expect(what(C.REFLECTING_POOL)).toEqual([]);
    expect(what(C.EXOTIC_ORCHARD)).toEqual([]);
    expect(what(C.SOL_RING)).toEqual([]);
  });

  /**
   * ⚠️ THE TWO MANA NOTES SAY OPPOSITE THINGS, and keeping them apart is the
   * point: `Its mana ability` means the app will not tap the source at all, so tap
   * it yourself; `Part of its mana ability` means it WILL tap it and add the mana
   * and do nothing else. One line can never raise both — a warning from
   * `parseManaProduction` means it recorded no production for that line, and the
   * new note is raised only where it did.
   */
  test('the two mana notes are opposite statements, and never collide', () => {
    expect(what(C.BLOOM_TENDER)).toContain('Its mana ability');
    expect(what(C.BLOOM_TENDER)).not.toContain('Part of its mana ability');
    expect(what(C.ANCIENT_TOMB)).not.toContain('Its mana ability');
  });

  test('a face is read on its own', () => {
    // Delver of Secrets' front face has an upkeep trigger; the back face is a
    // 3/2 flier the engine runs in full.
    const delver = C.DELVER_OF_SECRETS_INSECTILE_ABERRATION;
    expect(what(delver, 0)).toEqual(['Its ability text']);
    expect(what(delver, 1)).toEqual([]);
  });
});

describe('tier3SummaryFor', () => {
  test('caps the list at three and counts the rest', () => {
    const card = {
      ...C.GRIZZLY_BEARS,
      keywords: ['Crew', 'Equip', 'Cycling', 'Kicker', 'Morph'],
    };
    const summary = tier3SummaryFor(card);
    expect(summary).toContain('and 2 more');
    expect(summary?.startsWith('Not automatic:')).toBe(true);
  });

  test('no cap notice when there are three or fewer', () => {
    const card = { ...C.GRIZZLY_BEARS, keywords: ['Crew', 'Equip'] };
    expect(tier3SummaryFor(card)).toBe('Not automatic: Crew, Equip.');
  });
});

/**
 * A fixture with one face's oracle text replaced, keeping everything else real.
 *
 * ⚠️ `keywords` HAS TO BE PASSED whenever the replacement text carries a keyword
 * ability, because Scryfall always lists one there and `tier3.ts` reads it — a
 * synthetic card with `Ward—Discard a card.` in its text and an empty `keywords`
 * is a shape the real data never produces, and testing against it tests the edit
 * rather than the card (the D15b failure mode).
 */
function withText(card: CardData, oracleText: string, keywords = card.keywords): CardData {
  const face = card.faces[0]!;
  return { ...card, keywords, faces: [{ ...face, oracleText }, ...card.faces.slice(1)] };
}
