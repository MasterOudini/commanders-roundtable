// Activated abilities — `cost: effect`, parsed once at ingest.
//
// ⚠️ THE HONEST BOUNDARY, and it is the whole design: an ability is offered only
// when the engine can CHARGE its cost. Mana and {T}/{Q} it can charge. `Sacrifice
// this creature` (424 lines), `Pay 2 life` (294), `Discard a card` (227) are
// decisions rather than prices — exactly the distinction D68 drew for ward, where
// `ward—Pay N life` became a tax and `ward—Sacrifice a creature` stayed Tier 3
// because "pay two life" and "sacrifice a creature" are not the same promise and
// half-enforcing the second is worse than not enforcing it. Same rule here.
// Measured: 16,299 ability lines carry a cost the engine cannot pay. They stay
// manual and `tier3.ts` names them on the card.
//
// ⚠️ `isManaAbility` is ASKED OF `parseManaProduction`, matched by line index,
// never re-guessed. A mana ability leaking into `ActivateAbility` would put
// `{T}: Add {G}` on the stack — which CR 605 says never happens — and a real
// ability misclassified as mana would vanish from the action list entirely.
// `tier3.ts` learned this the hard way with Command Tower: a second heuristic
// beside the first is how a disclosure starts lying.
//
// Excluded by construction, which is a feature: `Equip {2}`, `Crew 8`,
// `Cycling {2}` and `Level up {1}` have NO COLON, so the line splitter never
// classifies them as activated and they stay Tier 3 exactly as `tier3.ts`
// already claims.

import type { ActivatedAbility, ManaProduction } from '../engine/types/oracle';
import type { ManaCost } from '../engine/types/mana';
import type { Warn } from './oracleParse';
import { parseTargetClauses, splitAbilityLines } from './targetParse';
import { predicatesOf } from './replacementParse';

const NOOP_WARN: Warn = () => undefined;

/** A loyalty cost: `+1`, `−3`, `-X`, `0`. Planeswalkers only. */
const LOYALTY_RE = /^[+−-]?(?:\d+|X)$/;

/** `Pay 3 life`. Same shape `parseWardLife` reads, and deliberately so. */
const LIFE_RE = /\bpay\s+(\d+)\s+life\b/i;

const SORCERY_ONLY_RE = /\bactivate\s+(?:this\s+ability\s+)?only\s+as\s+a\s+sorcery\b/i;

/**
 * Split a cost string on commas that separate cost components, not commas
 * inside a symbol. `{1}, {T}, Sacrifice a creature` → three parts.
 */
function costParts(costText: string): string[] {
  return costText
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p !== '');
}

/** Is this whole part payable in mana symbols alone? */
const MANA_ONLY_RE = /^(?:\{[^}]+\}\s*)+$/;
/**
 * D305 - "Equip {N}" and nothing else on the line (reminder text aside). A typed
 * equip ("Equip Knight {1}"), a non-mana equip cost ("Equip-Sacrifice a
 * creature") and Reconfigure stay where they were: Tier 3, by name.
 */
const EQUIP_RE = /^Equip ((?:\{[^}]+\})+)$/;
const EQUIP_EFFECT = 'Attach this Equipment to target creature you control.';
/**
 * D306 - "Cycling {N}" and nothing else on the line (reminder text aside). The
 * typed landcyclings ("Basic landcycling {2}", "Forestcycling {1}") search a
 * library and stay where they were - Tier 3, by name - until a search prompt
 * carries them.
 */
const CYCLING_RE = /^Cycling ((?:\{[^}]+\})+)$/;
const CYCLING_EFFECT = 'Draw a card.';
// D311 - THE CREW SEAM: "Crew N" on its own line (reminder text aside).
const CREW_RE = /^Crew (\d+)$/;
const CREW_EFFECT = 'This Vehicle becomes an artifact creature until end of turn.';

export interface ActivatedParseInput {
  readonly oracleText: string;
  readonly isPermanent: boolean;
  /** From `parseManaProduction` on the SAME face, so mana abilities are known. */
  readonly producesMana: readonly ManaProduction[];
  /** From `parseManaCost`, applied to the mana part of each cost. */
  readonly parseCost: (raw: string, warn?: Warn) => ManaCost | null;
  /** D320 - the face's short name, which an older printing uses where a newer one says "this creature". */
  readonly selfName?: string;
}

/**
 * Every activated ability on a face, in printed order.
 *
 * Returns `[]` for the common case — a vanilla creature, a basic land — which is
 * what keeps this cheap across a 113,559-card ingest.
 */
/** "a" / "an" / "one" … "five" → the number of cards or permanents a cost names. */
const COUNT_WORDS: Readonly<Record<string, number>> = {
  a: 1, an: 1, another: 1, one: 1, two: 2, three: 3, four: 4, five: 5,
};

/**
 * A plural predicate noun back to the singular `predicateOf` reads: "Clerics"
 * → "Cleric", "creatures" → "creature", "Elves" → "Elf". ⚠️ Only the LAST word
 * is touched and only when the count is plural; a noun the table and the
 * trailing-s rule both miss reaches `predicatesOf` unchanged and is refused
 * there, never widened.
 */
const PLURAL_NOUNS: Readonly<Record<string, string>> = {
  elves: 'Elf', dwarves: 'Dwarf', wolves: 'Wolf', allies: 'Ally', zombies: 'Zombie',
  faeries: 'Faerie', mercenaries: 'Mercenary', foxes: 'Fox', sphinxes: 'Sphinx',
  merfolk: 'Merfolk', kavu: 'Kavu', elk: 'Elk', mice: 'Mouse', werewolves: 'Werewolf',
};
function singularNoun(phrase: string, plural: boolean): string {
  if (!plural) return phrase;
  const words = phrase.trim().split(/\s+/);
  const last = words[words.length - 1] ?? '';
  const lower = last.toLowerCase();
  const single = PLURAL_NOUNS[lower] ?? (lower.endsWith('s') ? last.slice(0, -1) : last);
  words[words.length - 1] = single;
  return words.join(' ');
}

export function parseActivatedAbilities(
  input: ActivatedParseInput,
  warn: Warn = NOOP_WARN,
): ActivatedAbility[] {
  const { oracleText, isPermanent, producesMana, parseCost, selfName } = input;
  if (!oracleText) return [];

  // ⚠️ Asked, not guessed. A null `line` is an intrinsic land-type ability, which
  // has no printed line and so can never collide with one.
  const manaLines = new Set<number>();
  for (const p of producesMana) {
    if (p.line !== null) manaLines.add(p.line);
  }

  const out: ActivatedAbility[] = [];
  for (const line of splitAbilityLines(oracleText, isPermanent)) {
    // ⚠️ D305 - THE EQUIPMENT SEAM. "Equip {N}" prints no colon, so the splitter
    // files it as static; it IS an activated ability (CR 702.6a) whose cost the
    // engine can charge. Synthesized HERE, in print order, so `#a<index>` counts
    // it exactly where the card prints it and no other ability's ref moves.
    // ⚠️ Asked of the reminder-stripped text WHATEVER the splitter said: the
    // reminder "({3}: Attach to target creature you control. ...)" carries a
    // colon, so the splitter files the printed line as an activated ability
    // with the cost "Equip {3} ({3}" - and that reading must never win.
    const printed = line.text.replace(/\s*\([^)]*\)\s*$/, '').trim();
    const equip = EQUIP_RE.exec(printed);
    if (equip) {
      const equipCost = parseCost(equip[1] ?? '', warn);
      out.push({
        index: out.length,
        costText: equip[1] ?? '',
        effectText: EQUIP_EFFECT,
        manaCost: equipCost,
        requiresTap: false,
        requiresUntap: false,
        lifeCost: 0,
        lifeCostCommanderColors: false,
        sacrificesSelf: false,
        sacrificeCost: null,
        discardCost: null,
        removeCounterCost: null,
        tapCost: null,
        unpaidCosts: equipCost === null ? [equip[1] ?? ''] : [],
        payable: equipCost !== null,
        isManaAbility: false,
        isLoyalty: false,
        sorceryOnly: true,
        targets: parseTargetClauses(EQUIP_EFFECT, warn),
        equip: { line: printed },
      });
      continue;
    }
    // ⚠️ D306 - THE CYCLING SEAM. "Cycling {N}" is an activated ability from
    // the HAND (CR 702.29a) whose cost - the mana and the discard of the card
    // itself - the engine charges; synthesized in print order like Equip, from
    // the reminder-stripped text (the reminder "({2}, Discard this card: Draw a
    // card.)" carries a colon too).
    const cycling = CYCLING_RE.exec(printed);
    if (cycling) {
      const cyclingCost = parseCost(cycling[1] ?? '', warn);
      out.push({
        index: out.length,
        costText: cycling[1] ?? '',
        effectText: CYCLING_EFFECT,
        manaCost: cyclingCost,
        requiresTap: false,
        requiresUntap: false,
        lifeCost: 0,
        lifeCostCommanderColors: false,
        sacrificesSelf: false,
        sacrificeCost: null,
        discardCost: null,
        removeCounterCost: null,
        tapCost: null,
        unpaidCosts: cyclingCost === null ? [cycling[1] ?? ''] : [],
        payable: cyclingCost !== null,
        isManaAbility: false,
        isLoyalty: false,
        sorceryOnly: false,
        targets: [],
        cycling: { line: printed },
      });
      continue;
    }
    // D311 - THE CREW SEAM: "Crew N" is an activated ability with no mana in
    // its cost - tap any number of untapped creatures you control with total
    // power N or more (CR 702.122a) - and the engine's own effect: the Vehicle
    // is an artifact creature until end of turn. Instant speed, no targets.
    const crewLine = CREW_RE.exec(printed);
    if (crewLine) {
      const power = Number(crewLine[1] ?? '0');
      const crewAny = predicatesOf('creature');
      out.push({
        index: out.length,
        costText: `Crew ${power}`,
        effectText: CREW_EFFECT,
        manaCost: parseCost('{0}', warn),
        requiresTap: false,
        requiresUntap: false,
        lifeCost: 0,
        lifeCostCommanderColors: false,
        sacrificesSelf: false,
        sacrificeCost: null,
        discardCost: null,
        removeCounterCost: null,
        tapCost: crewAny === null ? null : { count: 0, another: true, any: crewAny, powerAtLeast: power },
        unpaidCosts: crewAny === null ? [`Crew ${power}`] : [],
        payable: crewAny !== null,
        isManaAbility: false,
        isLoyalty: false,
        sorceryOnly: false,
        targets: [],
        crew: { line: printed, power },
      });
      continue;
    }
    if (line.kind !== 'activated') continue;

    const parts = costParts(line.costText);
    const manaSymbols: string[] = [];
    const unpaidCosts: string[] = [];
    let requiresTap = false;
    let requiresUntap = false;
    let lifeCost = 0;
    let lifeCostCommanderColors = false;
    let sacrificesSelf = false;
    let sacrificeCost: ActivatedAbility['sacrificeCost'] = null;
    let discardCost: ActivatedAbility['discardCost'] = null;
    let tapCost: ActivatedAbility['tapCost'] = null;
    let removeCounterCost: ActivatedAbility['removeCounterCost'] = null;
    let isLoyalty = false;

    for (const part of parts) {
      if (part === '{T}') {
        requiresTap = true;
        continue;
      }
      if (part === '{Q}') {
        requiresUntap = true;
        continue;
      }
      if (LOYALTY_RE.test(part)) {
        isLoyalty = true;
        continue;
      }
      if (MANA_ONLY_RE.test(part)) {
        manaSymbols.push(part);
        continue;
      }
      const life = part.match(LIFE_RE);
      if (life && /^pay\s+\d+\s+life$/i.test(part.trim())) {
        lifeCost += Number(life[1] ?? 0);
        continue;
      }
      // ⚠️ WAR ROOM'S EXACT PHRASE AND ONLY THAT PHRASE (D90, D159). The number
      // is board-dependent, so the parse records the RULE and the activation
      // computes it from the player's identity. Any other "pay life equal to…"
      // wording stays unpaid — a computed cost the engine cannot compute is a
      // cost it cannot charge.
      if (/^pay life equal to the number of colors in your commanders' color identity$/i.test(part.trim())) {
        lifeCostCommanderColors = true;
        continue;
      }
      // ⚠️ SELF-sacrifice only — "Sacrifice this artifact/creature/land/…" is
      // deterministic (no chooser), so it is a PRICE the engine can take
      // (D159). "Sacrifice a creature" is a decision and stays unpaid, exactly
      // the ward distinction D68 drew. ⚠️ Chargeable is not offerable — see
      // `ActivatedAbility.sacrificesSelf` and `legal.ts`'s def gate.
      if (/^sacrifice this [a-z]+$/i.test(part.trim())) {
        sacrificesSelf = true;
        continue;
      }
      // ⚠️ The CHOOSER half (D168): "Sacrifice a creature" / "another
      // creature or artifact" / "a Food" — a decision, priced by letting the
      // ACTIVATION name the permanent (`ActivateAbility.sacrifice`).
      // Anchored both ends; a phrase `predicatesOf` cannot read stays in
      // `unpaidCosts`, so "Sacrifice a creature with power 4" is refused
      // rather than widened. "a permanent" is the empty predicate — every
      // `.every` over empty arrays holds, which is exactly what the word
      // means. Chargeable is not offerable: the def gate in `legal.ts` and
      // `handlers.ts` still refuses an undef'd ability (D159's rule).
      const sac = /^sacrifice (a|an|another) (.+)$/i.exec(part.trim());
      if (sac && sacrificeCost === null) {
        const another = (sac[1] ?? '').toLowerCase() === 'another';
        const rest = (sac[2] ?? '').trim();
        const any =
          /^permanents?$/i.test(rest)
            ? [{ supertypes: [], types: [], subtypes: [], colors: [] }]
            : predicatesOf(rest);
        if (any !== null) {
          sacrificeCost = { another, any };
          continue;
        }
      }
      // ⚠️ The DISCARD chooser (D286): "Discard a card" / "Discard two cards"
      // / "Discard a land card" — a decision, priced by letting the activation
      // name the cards (`ActivateAbility.discard`). "a card" is ANY card
      // (`any: null`); a typed card goes through `predicatesOf` with the word
      // "card(s)" stripped, and a phrase it cannot place ("a nonland card",
      // "two nonland cards with the same name") stays in `unpaidCosts`.
      const disc = /^discard (a|an|one|two|three|four) (.+)$/i.exec(part.trim());
      if (disc && discardCost === null) {
        const count = COUNT_WORDS[(disc[1] ?? '').toLowerCase()] ?? 0;
        const rest = (disc[2] ?? '').trim();
        if (count > 0 && /^cards?$/i.test(rest)) {
          discardCost = { count, any: null };
          continue;
        }
        const stripped = rest.replace(/\s+cards?$/i, '');
        if (count > 0 && stripped !== rest) {
          const any = predicatesOf(singularNoun(stripped, count > 1));
          if (any !== null) {
            discardCost = { count, any };
            continue;
          }
        }
      }
      // ⚠️ The TAP chooser (D286): "Tap an untapped creature you control" /
      // "Tap two untapped Wizards you control" / "Tap another untapped
      // creature you control" — the activation names the permanents
      // (`ActivateAbility.tap`). Anchored both ends; the plural noun is
      // read back to the singular before `predicatesOf`.
      const tapm = /^tap (a|an|another|one|two|three|four|five) untapped (.+) you control$/i.exec(part.trim());
      if (tapm && tapCost === null) {
        const word = (tapm[1] ?? '').toLowerCase();
        const count = COUNT_WORDS[word] ?? 0;
        const any = count > 0 ? predicatesOf(singularNoun((tapm[2] ?? '').trim(), count > 1)) : null;
        if (any !== null) {
          tapCost = { count, another: word === 'another', any };
          continue;
        }
      }
      // ⚠️ The REMOVE-A-COUNTER cost (D319): "Remove a +1/+1 counter from this
      // creature" / "Remove two charge counters from this artifact" - SELF only
      // and a fixed count, so it is deterministic (no chooser): a PRICE the
      // engine can take, offered only while the permanent carries the counters.
      // "from a creature you control" is a decision and stays unpaid; "X" stays
      // unpaid (a computed cost the engine cannot compute). Chargeable is not
      // offerable: the def gate in `legal.ts` and `handlers.ts` still refuses an
      // undef'd ability (D159's rule).
      // D320 - "from this creature" on a newer printing, "from Brigone" on an older one.
      const selfAlt = selfName ? '|' + selfName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '';
      const rc = new RegExp('^remove (a|an|one|two|three|four|five) ([^ ]+) counters? from (?:this [a-z]+' + selfAlt + ')$', 'i').exec(part.trim());
      if (rc && removeCounterCost === null) {
        const count = COUNT_WORDS[(rc[1] ?? '').toLowerCase()] ?? 0;
        const kind = rc[2] ?? '';
        if (count > 0 && kind !== '') {
          removeCounterCost = { kind, count };
          continue;
        }
      }
      unpaidCosts.push(part);
    }

    const raw = manaSymbols.join('');
    const manaCost = raw === '' ? null : parseCost(raw, warn);
    const isManaAbility = manaLines.has(line.index);

    if (isLoyalty) warn('activated:loyalty');
    else if (unpaidCosts.length > 0) warn('activated:nonManaCost');

    // ⚠️ A life cost IS payable — `parseWardLife` set that precedent in M5 and
    // the payment problem already carries a life component. But loyalty is not,
    // because it needs once-per-turn tracking and a counter cost that do not
    // exist, and an ability whose cost we cannot charge is not offered at all.
    const payable = unpaidCosts.length === 0 && !isLoyalty;

    out.push({
      index: out.length,
      costText: line.costText,
      effectText: line.effectText,
      manaCost,
      requiresTap,
      requiresUntap,
      lifeCost,
      lifeCostCommanderColors,
      sacrificesSelf,
      sacrificeCost,
      discardCost,
      tapCost,
      removeCounterCost,
      unpaidCosts,
      payable,
      isManaAbility,
      isLoyalty,
      sorceryOnly: SORCERY_ONLY_RE.test(line.text),
      // The same clause parser the spell path uses — one grammar, not two.
      // Measured: 6,082 ability lines contain a target clause.
      targets: parseTargetClauses(line.effectText, warn),
    });
  }

  return out;
}
