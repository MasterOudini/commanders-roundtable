import { describe, expect, test } from 'vitest';
import {
  parseKeywords,
  parseManaCost,
  parseManaProduction,
  parseProtection,
  parseTypeLine,
  parseWard,
  parseWardLife,
  parseFace,
} from './oracleParse';
import { parseToxic } from '../engine/keywords';
import * as C from './fixtures/engineCards';
import type { CardData } from './cardTypes';
import type { ManaPool } from '../engine/types/mana';

// The fixtures are verbatim real cards (see scripts/make-engine-fixtures.cjs),
// so these assertions are about what Wizards actually printed, not about a
// paraphrase somebody typed into a test file.

function face(card: CardData, i = 0) {
  const f = card.faces[i];
  if (!f) throw new Error(`${card.name} has no face ${i}`);
  return f;
}

function typeOf(card: CardData, i = 0) {
  return parseTypeLine(face(card, i).typeLine);
}

function produced(card: CardData, i = 0) {
  return parseManaProduction(face(card, i), typeOf(card, i));
}

function poolOf(p: ManaPool): string {
  return (['W', 'U', 'B', 'R', 'G', 'C'] as const)
    .flatMap((k) => Array.from({ length: p[k] }, () => `{${k}}`))
    .join('');
}

describe('parseManaCost', () => {
  test('no cost is null, which is NOT a cost of zero', () => {
    // A land has no mana cost; Mox Diamond costs {0}. Conflating them makes
    // every land look like a free spell to legalActions.
    expect(parseManaCost('')).toBeNull();
    expect(parseManaCost(face(C.FOREST).manaCost)).toBeNull();
    const zero = parseManaCost(face(C.MOX_DIAMOND).manaCost);
    expect(zero).not.toBeNull();
    expect(zero?.manaValue).toBe(0);
  });

  test('generic + coloured', () => {
    const c = parseManaCost(face(C.SERRA_ANGEL).manaCost);
    expect(c?.raw).toBe('{3}{W}{W}');
    expect(c?.generic).toBe(3);
    expect(c?.colored.W).toBe(2);
    expect(c?.manaValue).toBe(5);
  });

  test('multicolour', () => {
    const c = parseManaCost(face(C.KESS_DISSIDENT_MAGE).manaCost);
    expect(c?.generic).toBe(1);
    expect(c?.colored).toEqual({ W: 0, U: 1, B: 1, R: 1, G: 0 });
    expect(c?.manaValue).toBe(4);
  });

  test('{C} is colourless, not generic', () => {
    const c = parseManaCost('{2}{C}');
    expect(c?.generic).toBe(2);
    expect(c?.colorless).toBe(1);
    expect(c?.manaValue).toBe(3);
  });

  test('{X} adds nothing to mana value and is counted separately', () => {
    const c = parseManaCost('{X}{X}{R}');
    expect(c?.xCount).toBe(2);
    expect(c?.manaValue).toBe(1);
  });

  test('a colour hybrid becomes one symbol with two colour options', () => {
    const c = parseManaCost(face(C.FIGURE_OF_DESTINY).manaCost);
    expect(c?.hybrids).toHaveLength(1);
    expect(c?.hybrids[0]?.options).toEqual([
      { kind: 'color', color: 'R' },
      { kind: 'color', color: 'W' },
    ]);
    expect(c?.manaValue).toBe(1);
  });

  test('a monocolour hybrid {2/W} takes the HIGHER half as its mana value', () => {
    const c = parseManaCost('{2/W}{2/W}');
    expect(c?.manaValue).toBe(4);
    expect(c?.hybrids[0]?.options).toEqual([
      { kind: 'generic', amount: 2 },
      { kind: 'color', color: 'W' },
    ]);
  });

  test('phyrexian is a hybrid whose other half is 2 life', () => {
    const c = parseManaCost(face(C.GITAXIAN_PROBE).manaCost);
    expect(c?.hybrids).toHaveLength(1);
    expect(c?.hybrids[0]?.options).toEqual([
      { kind: 'color', color: 'U' },
      { kind: 'life', amount: 2 },
    ]);
    expect(c?.manaValue).toBe(1);
  });

  test('mana value agrees with Scryfall for every fixture', () => {
    for (const card of C.ENGINE_CARDS) {
      const front = card.faces[0];
      if (!front) continue;
      // Scryfall's cmc for a split card is the sum of both halves and for a
      // transform card is the front face's, so only single-faced cards can be
      // compared directly.
      if (card.faces.length !== 1) continue;
      const cost = parseManaCost(front.manaCost);
      expect(cost?.manaValue ?? 0, card.name).toBe(card.cmc);
    }
  });

  test('a stray character is reported rather than silently dropped', () => {
    const seen: string[] = [];
    parseManaCost('{2}Q{W}', (c) => seen.push(c));
    expect(seen).toContain('manaCost:strayCharacters');
  });
});

describe('parseTypeLine', () => {
  test('supertypes, types and subtypes split at the em dash', () => {
    const t = typeOf(C.KESS_DISSIDENT_MAGE);
    expect(t.supertypes).toEqual(['Legendary']);
    expect(t.types).toEqual(['Creature']);
    expect(t.subtypes).toEqual(['Human', 'Wizard']);
  });

  test('a basic land keeps its Basic supertype and land subtype', () => {
    const t = typeOf(C.FOREST);
    expect(t.supertypes).toEqual(['Basic']);
    expect(t.types).toEqual(['Land']);
    expect(t.subtypes).toEqual(['Forest']);
  });

  test('a dual land carries both land types', () => {
    expect(typeOf(C.TUNDRA).subtypes).toEqual(['Plains', 'Island']);
  });

  test('multiple card types on one line', () => {
    const t = typeOf(C.BALEFUL_STRIX);
    expect(t.types).toEqual(['Artifact', 'Creature']);
  });

  test('no subtypes when there is no dash', () => {
    const t = typeOf(C.SOL_RING);
    expect(t.types).toEqual(['Artifact']);
    expect(t.subtypes).toEqual([]);
  });

  test('a Vehicle is not a creature — the D15 case', () => {
    const t = typeOf(C.SHORIKAI_GENESIS_ENGINE);
    expect(t.types).toEqual(['Artifact']);
    expect(t.subtypes).toEqual(['Vehicle']);
    expect(t.supertypes).toEqual(['Legendary']);
  });
});

describe('parseKeywords', () => {
  test('takes Tier-2 keywords from Scryfall, dropping the rest', () => {
    expect(parseKeywords(C.SERRA_ANGEL, 0).sort()).toEqual(['flying', 'vigilance']);
    expect(parseKeywords(C.VAMPIRE_NIGHTHAWK, 0).sort()).toEqual(['deathtouch', 'flying', 'lifelink']);
    expect(parseKeywords(C.BOROS_SWIFTBLADE, 0)).toEqual(['doubleStrike']);
    expect(parseKeywords(C.BOGGART_BRUTE, 0)).toEqual(['menace']);
    expect(parseKeywords(C.WALL_OF_OMENS, 0)).toEqual(['defender']);
  });

  test('an untracked keyword is simply absent', () => {
    // Shorikai has "Crew", which the engine does not automate.
    expect(parseKeywords(C.SHORIKAI_GENESIS_ENGINE, 0)).toEqual([]);
  });

  /**
   * ⚠️ Scryfall reports ONE keyword array for the whole card, so a
   * double-faced card's back-face keywords would otherwise land on the front.
   * Delver of Secrets is the canonical case: the card is tagged `Flying`, but
   * only the transformed Insectile Aberration has it.
   */
  test('a double-faced card does not leak the back face keywords to the front', () => {
    expect(parseKeywords(C.DELVER_OF_SECRETS_INSECTILE_ABERRATION, 0)).toEqual([]);
    expect(parseKeywords(C.DELVER_OF_SECRETS_INSECTILE_ABERRATION, 1)).toEqual(['flying']);
  });

  test('lightning greaves grants haste and shroud but does not have them', () => {
    // The grant is card text, which is Tier 3. Scryfall agrees: its keyword
    // array is ["Equip"] only.
    expect(parseKeywords(C.LIGHTNING_GREAVES, 0)).toEqual([]);
  });
});

describe('parseProtection', () => {
  test('a single colour', () => {
    const p = parseProtection(face(C.KOR_FIREWALKER).oracleText);
    expect(p.colors).toEqual(['R']);
    expect(p.fromEverything).toBe(false);
  });

  test('reminder text in parentheses does not confuse it', () => {
    const p = parseProtection(face(C.WHITE_KNIGHT).oracleText);
    expect(p.colors).toEqual(['B']);
    expect(p.other).toEqual([]);
  });

  test('several colours in one clause', () => {
    expect(parseProtection('Protection from black and from blue').colors).toEqual(['B', 'U']);
    expect(parseProtection('Protection from all colors').colors).toEqual(['W', 'U', 'B', 'R', 'G']);
  });

  test('protection from everything', () => {
    expect(parseProtection('Protection from everything').fromEverything).toBe(true);
  });

  test('a non-colour protection is recorded as UNENFORCED rather than guessed at', () => {
    const seen: string[] = [];
    const p = parseProtection('Protection from creatures', (c) => seen.push(c));
    expect(p.colors).toEqual([]);
    expect(p.other).toEqual(['creatures']);
    expect(seen).toContain('protection:unenforced');
  });

  test('no protection text is the shared empty value', () => {
    expect(parseProtection(face(C.GRIZZLY_BEARS).oracleText).colors).toEqual([]);
  });
});

describe('parseWard', () => {
  test('a mana ward parses to a cost', () => {
    expect(parseWard('Ward {2}')?.generic).toBe(2);
    expect(parseWard('Ward {W}{U}')?.colored).toEqual({ W: 1, U: 1, B: 0, R: 0, G: 0 });
  });

  test('a life ward is not a mana cost', () => {
    // `parseWardLife` owns this case now; `parseWard` reports only mana.
    expect(parseWard('Ward—Pay 3 life.')).toBeNull();
  });

  test('no ward is null', () => {
    expect(parseWard(face(C.GRIZZLY_BEARS).oracleText)).toBeNull();
  });
});

describe('parseWardLife', () => {
  // ⚠️ M5 promotion (D68). `ward—Pay N life` is a TAX: fixed price, no choice,
  // no target, so the engine can charge it exactly as it charges a mana ward.
  test('a life ward parses to its amount', () => {
    expect(parseWardLife('Ward—Pay 3 life.')).toBe(3);
    expect(parseWardLife('Ward—Pay 2 life.')).toBe(2);
    // Em dash, en dash and hyphen all appear in real oracle text.
    expect(parseWardLife('Ward–Pay 4 life.')).toBe(4);
    expect(parseWardLife('Ward-Pay 5 life.')).toBe(5);
  });

  test('a life ward does not warn — it is enforced', () => {
    const seen: string[] = [];
    expect(parseWardLife('Ward—Pay 3 life.', (c) => seen.push(c))).toBe(3);
    expect(seen).toEqual([]);
  });

  test('a mana ward is left to parseWard and is not double-counted', () => {
    const seen: string[] = [];
    expect(parseWardLife('Ward {2}', (c) => seen.push(c))).toBe(0);
    expect(seen).toEqual([]);
  });

  /**
   * ⚠️ The Tier-2/Tier-3 line, stated as a test. "Discard a card" and
   * "sacrifice a creature" are decisions, not prices — half-enforcing them
   * would be worse than not enforcing them, because players would stop
   * checking the card.
   */
  test('a ward that is a DECISION stays unenforced and is still reported', () => {
    for (const text of [
      'Ward—Discard a card.',
      'Ward—Sacrifice a creature.',
      'Ward—Collect evidence 4.',
    ]) {
      const seen: string[] = [];
      expect(parseWardLife(text, (c) => seen.push(c))).toBe(0);
      expect(seen).toContain('ward:nonManaCost');
    }
  });

  /**
   * ⚠️ A VARIABLE price is deliberately refused. The engine would have to
   * re-read the creature's power at cast time, and a ward charged at the wrong
   * price is exactly the "confidently wrong" failure the tier line prevents.
   */
  test('a variable life ward is refused rather than guessed at', () => {
    const seen: string[] = [];
    expect(parseWardLife("Ward—Pay life equal to this creature's power.", (c) => seen.push(c))).toBe(0);
    expect(seen).toContain('ward:nonManaCost');
  });

  test('no ward is zero, and does not warn', () => {
    const seen: string[] = [];
    expect(parseWardLife(face(C.GRIZZLY_BEARS).oracleText, (c) => seen.push(c))).toBe(0);
    expect(seen).toEqual([]);
  });
});

describe('parseToxic', () => {
  // ⚠️ Scryfall reports a bare "Toxic" with no amount — same shape as Landwalk
  // and Protection, and for the same reason the amount comes from the text.
  test('toxic parses its amount', () => {
    expect(parseToxic('Toxic 1 (Players dealt combat damage by this creature also get a poison counter.)')).toBe(1);
    expect(parseToxic('Flying, toxic 3')).toBe(3);
  });

  test('no toxic is zero', () => {
    expect(parseToxic('Flying, trample')).toBe(0);
    // A bare "toxic" with no number enforces NOTHING rather than something wrong.
    expect(parseToxic('Toxic')).toBe(0);
  });
});

describe('parseManaProduction', () => {
  test('a basic land taps for its colour', () => {
    const p = produced(C.FOREST);
    expect(p).toHaveLength(1);
    expect(p[0]?.requiresTap).toBe(true);
    expect(p[0]?.conditional).toBe(false);
    expect(poolOf(p[0]!.outputs[0]!.mana)).toBe('{G}');
  });

  test('every basic covers its own symbol', () => {
    const pairs: [typeof C.PLAINS, string][] = [
      [C.PLAINS, '{W}'],
      [C.ISLAND, '{U}'],
      [C.SWAMP, '{B}'],
      [C.MOUNTAIN, '{R}'],
      [C.FOREST, '{G}'],
      [C.WASTES, '{C}'],
    ];
    for (const [card, sym] of pairs) {
      expect(poolOf(produced(card)[0]!.outputs[0]!.mana), card.name).toBe(sym);
    }
  });

  test('a snow basic still taps for its colour', () => {
    expect(poolOf(produced(C.SNOW_COVERED_FOREST)[0]!.outputs[0]!.mana)).toBe('{G}');
  });

  /**
   * ⚠️ THE CASE THAT FORCED THE INTRINSIC PASS. Scryfall's oracle text for the
   * original dual lands is the empty string — the ability comes from the land
   * types (CR 305.6). A text-only parser reports that Tundra taps for nothing,
   * and the affordability filter greys out half a real deck's hand.
   */
  test('a dual land with NO oracle text still taps for both colours', () => {
    const p = produced(C.TUNDRA);
    expect(p).toHaveLength(2);
    expect(p.map((x) => poolOf(x.outputs[0]!.mana)).sort()).toEqual(['{U}', '{W}']);
  });

  test('reminder text does not create a duplicate ability', () => {
    // Tundra reads "({T}: Add {W} or {U}.)" — a fully parenthesised line. Left
    // in, it would give one physical land three tap options in the payment UI.
    expect(produced(C.TUNDRA)).toHaveLength(2);
    expect(produced(C.FOREST)).toHaveLength(1);
  });

  test('an artifact that taps for two colourless', () => {
    const p = produced(C.SOL_RING);
    expect(p).toHaveLength(1);
    expect(poolOf(p[0]!.outputs[0]!.mana)).toBe('{C}{C}');
    expect(p[0]?.outputs[0]?.amount).toBe(2);
  });

  test('a creature that taps for mana', () => {
    expect(poolOf(produced(C.LLANOWAR_ELVES)[0]!.outputs[0]!.mana)).toBe('{G}');
  });

  test('"any colour" is deferred to solve time rather than expanded now', () => {
    const p = produced(C.BIRDS_OF_PARADISE);
    expect(p).toHaveLength(1);
    expect(p[0]?.anyColor).toEqual({ scope: 'all', amount: 1 });
    expect(p[0]?.conditional).toBe(false);
  });

  /**
   * ⚠️ Command Tower must NOT be conditional. Marking it so would exclude the
   * single most-played land in the format from auto-tap. The engine knows the
   * controller's commander colour identity exactly, so the expansion is a
   * lookup at solve time, not a guess.
   */
  test('Command Tower is identity-scoped and still auto-tappable', () => {
    const p = produced(C.COMMAND_TOWER);
    expect(p).toHaveLength(1);
    expect(p[0]?.anyColor).toEqual({ scope: 'identity', amount: 1 });
    expect(p[0]?.conditional).toBe(false);
  });

  test('a land producing two different colours at once', () => {
    const p = produced(C.BOROS_GARRISON);
    expect(p).toHaveLength(1);
    // poolOf renders in WUBRG order; the printed order is "{R}{W}".
    expect(poolOf(p[0]!.outputs[0]!.mana)).toBe('{W}{R}');
  });

  test('"Spend this mana only on…" is conditional — excluded from auto-tap', () => {
    const p = produced(C.CAVERN_OF_SOULS);
    const restricted = p.find((x) => x.anyColor !== null);
    expect(restricted?.conditional).toBe(true);
    const plain = p.find((x) => x.anyColor === null);
    expect(plain?.conditional).toBe(false);
    expect(poolOf(plain!.outputs[0]!.mana)).toBe('{C}');
  });

  test('an activation cost beyond {T} is conditional', () => {
    // Gemstone Mine: "{T}, Remove a mining counter…". Paying a non-mana cost is
    // a decision the player must make, so the solver may not make it for them.
    const p = produced(C.GEMSTONE_MINE);
    expect(p).toHaveLength(1);
    expect(p[0]?.conditional).toBe(true);
  });

  test('a land whose ability the parser cannot model produces nothing, loudly', () => {
    const seen: string[] = [];
    const p = parseManaProduction(face(C.REFLECTING_POOL), typeOf(C.REFLECTING_POOL), (c) => seen.push(c));
    expect(p).toEqual([]);
    expect(seen.length).toBeGreaterThan(0);
  });

  test('a card with no mana ability produces nothing', () => {
    expect(produced(C.GRIZZLY_BEARS)).toEqual([]);
    expect(produced(C.LIGHTNING_BOLT)).toEqual([]);
  });
});

describe('parseFace', () => {
  test('a vanilla creature', () => {
    const f = parseFace(C.GRIZZLY_BEARS, 0);
    expect(f.basePower).toBe(2);
    expect(f.baseToughness).toBe(2);
    expect(f.isCreature).toBe(true);
    expect(f.isPermanent).toBe(true);
    expect(f.instantSpeed).toBe(false);
  });

  test('a `*` power is not a number — a script would set it, and there are none', () => {
    const f = parseFace(C.TARMOGOYF, 0);
    expect(f.printedPower).toBe('*');
    expect(f.basePower).toBeNull();
    expect(f.baseToughness).toBeNull();
  });

  test('an instant is instant-speed and not a permanent', () => {
    const f = parseFace(C.LIGHTNING_BOLT, 0);
    expect(f.instantSpeed).toBe(true);
    expect(f.isPermanent).toBe(false);
  });

  test('flash makes a creature instant-speed', () => {
    const f = parseFace(C.AMBUSH_VIPER, 0);
    expect(f.keywords).toContain('flash');
    expect(f.instantSpeed).toBe(true);
  });

  test('a planeswalker carries its loyalty', () => {
    const f = parseFace(C.GRIST_THE_HUNGER_TIDE, 0);
    expect(f.baseLoyalty).toBe(3);
    expect(f.isPermanent).toBe(true);
    expect(f.isCreature).toBe(false);
  });

  test('landwalk names the land type', () => {
    expect(parseFace(C.BULL_HIPPO, 0).landwalk).toEqual(['Island']);
  });

  test('a split card has an independent cost and type per face', () => {
    const a = parseFace(C.FIRE_ICE, 0);
    const b = parseFace(C.FIRE_ICE, 1);
    expect(a.manaCost?.colored.R).toBe(1);
    expect(b.manaCost?.colored.U).toBe(1);
    expect(a.name).toBe('Fire');
    expect(b.name).toBe('Ice');
  });

  test('every fixture parses without throwing', () => {
    for (const card of C.ENGINE_CARDS) {
      for (let i = 0; i < card.faces.length; i++) {
        expect(() => parseFace(card, i), `${card.name} face ${i}`).not.toThrow();
      }
    }
  });
});
