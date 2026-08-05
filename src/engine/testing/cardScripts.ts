// Real card scripts, for tests only.
//
// ⚠️ NOT SHIPPED. `SHIPPED_REGISTRY` is still what the app runs (`registry.ts`),
// and nothing outside `*.test.ts` / `*.node.test.ts` imports this file. Landing
// scripts into the product is M6.4, and it has an accounting obligation this
// file deliberately does not take on: when a script ships, that card's
// `tier3.ts` note must go silent and `engineComplete` must accept it, in the
// same commit (M6.4-LIBRARY-SPEC §6.5). A test registry owes nothing to either,
// because no player is being told anything.
//
// ⚠️ WHAT IT IS FOR: a primitive proved on a fixture trigger is a primitive
// proved against itself. `turn.test.ts`'s `upkeepTrigger` resolves to `[]` — it
// exists to show ordering — so nothing until now has run a real card's real text
// through the bus. D128 needed one that a player could point at.

import {
  AJANI_S_MANTRA,
  AJANI_S_PRIDEMATE,
  GRAVITY_SPHERE,
  LEVITATION,
  BRANCHING_EVOLUTION,
  HARDENED_SCALES,
  HUMILITY,
  KNIGHTHOOD,
  KWENDE_PRIDE_OF_FEMEREF,
  SPINELESS_THUG,
  YOTIAN_DISSIDENT,
} from '../../data/fixtures/engineCards';
import { parseTargetClauses } from '../../data/targetParse';
import type { CardData } from '../../data/cardTypes';
import type { CardScript } from '../scripts/api';
import type { EventBody } from '../types/events';

/**
 * The exact printed text a script claims to run, checked at import.
 *
 * ⚠️ CHECKED, NOT COMMENTED. D90's rule is that a script runs every word of its
 * card or is not registered — which is a claim about the words, and the words
 * live in a generated fixture that `engineCards.node.test.ts` re-reads from the
 * live database. If Scryfall rewords a card this throws with the new text in the
 * message, rather than quietly running a script written for a sentence that no
 * longer exists.
 */
function printed(card: CardData, expected: string): string {
  const actual = card.faces[0]?.oracleText;
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const MANTRA_TEXT = printed(AJANI_S_MANTRA, 'At the beginning of your upkeep, you may gain 1 life.');
const PRIDEMATE_TEXT = printed(
  AJANI_S_PRIDEMATE,
  'Whenever you gain life, put a +1/+1 counter on this creature.',
);
const YOTIAN_TEXT = printed(
  YOTIAN_DISSIDENT,
  'Whenever an artifact you control enters, put a +1/+1 counter on target creature you control.',
);
/**
 * ⚠️ **PARSED FROM THE CARD'S OWN WORDS, NOT HAND-WRITTEN.** A literal spec here
 * would be a second opinion about what the sentence says, sitting beside the
 * parser that already answers it — the rule five entries of DECISIONS.md have
 * had to write down (D122, D127, D129, D130, D131). It also means the
 * restriction the test asserts on ("you control") is the one the ingest reads,
 * so a parser that stopped reading it would fail here rather than silently
 * widen what the trigger may hit.
 */
const YOTIAN_TARGETS = parseTargetClauses(YOTIAN_TEXT);

const THUG_TEXT = printed(SPINELESS_THUG, "This creature can't block.");

const LEVITATION_TEXT = printed(LEVITATION, 'Creatures you control have flying.');
const GRAVITY_TEXT = printed(GRAVITY_SPHERE, 'All creatures lose flying.');

/**
 * `Ajani's Mantra` — `{1}{W}` Enchantment, and its whole text is one optional
 * trigger. See D128.
 *
 * ⚠️ `optional: true` is the point of the file. Before D128 nothing anywhere
 * branched on that flag, so this card gained 1 life every upkeep whether its
 * controller wanted it or not.
 *
 * ⚠️ "YOUR upkeep", so `matches` compares the active player against the
 * controller. Without that clause it fires on all four upkeeps of a turn cycle,
 * which is a different card.
 */
export const AJANIS_MANTRA: CardScript = {
  oracleId: AJANI_S_MANTRA.oracleId,
  name: AJANI_S_MANTRA.name,
  triggers: [
    {
      abilityId: 'upkeep',
      text: MANTRA_TEXT,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: true,
      matches: (ctx, self, ev) =>
        ev.t === 'StepBegan' &&
        ev.step === 'upkeep' &&
        ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Ajani's Mantra — gain 1 life",
      // ⚠️ No narration of its own, exactly like `effects.ts`'s `gainLife`.
      // `resolveAbility` writes the decision line and the "resolves" line, and a
      // third sentence saying the same thing is how a log becomes unreadable.
      resolve: (ctx, self): readonly EventBody[] => {
        const controller = ctx.query.controllerOf(self);
        const player = controller ? ctx.state.players[controller] : undefined;
        if (!controller || !player) return [];
        return [{ t: 'LifeChanged', player: controller, delta: 1, to: player.life + 1 }];
      },
    },
  ],
};

/**
 * `Levitation` — `{2}{U}{U}` Enchantment, "Creatures you control have flying."
 * A LAYER 6 grant, and the whole card. See D129.
 *
 * ⚠️ This is what D82 was waiting for. Hexproof and shroud have been enforced
 * only where PRINTED since the targeting work, because "a granted one needs a
 * layer-6 script" — and no layer-6 script had ever existed. `canBlock` reads
 * DERIVED keywords, so a creature this grants flying to becomes unblockable by
 * a ground creature with no change to `combat.ts` at all.
 */
export const LEVITATION_SCRIPT: CardScript = {
  oracleId: LEVITATION.oracleId,
  name: LEVITATION.name,
  statics: [
    {
      abilityId: 'flying',
      text: LEVITATION_TEXT,
      layer: 'ability',
      activeZones: ['battlefield'],
      // "Creatures you control" — the ENCHANTMENT's controller, and only
      // creatures. `appliesTo` is asked once per candidate object, so this is
      // the whole of the card's scope.
      // ⚠️ `chars.typeLine`, NEVER `ctx.derive(candidate)`. This runs inside the
      // candidate's own derive, so deriving it again is unbounded recursion —
      // the first cut of this very script blew the stack. `chars` is also the
      // BETTER answer: it has layer 4 applied, where a printed type line does
      // not.
      appliesTo: (ctx, self, candidate, chars) => {
        const source = ctx.state.cards[self];
        const target = ctx.state.cards[candidate];
        if (!source || !target || target.zone.kind !== 'battlefield') return false;
        if (target.controller !== source.controller) return false;
        return chars.typeLine.types.includes('Creature');
      },
      modify: (chars) => {
        chars.keywords.add('flying');
      },
    },
  ],
};

/**
 * `Gravity Sphere` — `{2}{R}` World Enchantment, "All creatures lose flying."
 * The other half of the CR 613.7 pair, and the reason `Levitation` alone proves
 * nothing about ORDER: two grants commute, a grant and a removal do not.
 *
 * ⚠️ **WORLD — and choosing it is what found that this engine had no world rule**
 * (CR 704.5m: all but the newest world permanent are put into their owners'
 * graveyards). D129 named the gap; **D147 built it**, in `sba.ts`, so two of
 * these can no longer sit on one battlefield. Nothing about this script changed:
 * the rule is a state-based action, not a card ability.
 */
export const GRAVITY_SPHERE_SCRIPT: CardScript = {
  oracleId: GRAVITY_SPHERE.oracleId,
  name: GRAVITY_SPHERE.name,
  statics: [
    {
      abilityId: 'no-flying',
      text: GRAVITY_TEXT,
      layer: 'ability',
      activeZones: ['battlefield'],
      // "All creatures" — everyone's, including its own controller's.
      appliesTo: (ctx, _self, candidate, chars) =>
        ctx.state.cards[candidate]?.zone.kind === 'battlefield' &&
        chars.typeLine.types.includes('Creature'),
      modify: (chars) => {
        chars.keywords.delete('flying');
      },
    },
  ],
};

/**
 * `Ajani's Pridemate` — `{1}{W}` 2/2, "Whenever you gain life, put a +1/+1
 * counter on this creature."
 *
 * ⚠️ **THIS SCRIPT NEEDED NOTHING FROM M6.3c.** `CountersChanged` has been on
 * the log since D107 and a `TriggerDef` returns `EventBody[]`, so a permanent
 * that puts counters has been scriptable since M3 — which is the measurement
 * correction D130 exists to make. D127 filed 1,441 cards under `effect:counter`
 * because its proxy for "could a script express you" is `parseEffects`, and
 * `parseEffects` is the INGEST vocabulary for one-shot SPELLS. It has nothing to
 * say about what a script may return.
 *
 * ⚠️ It also chains off `AJANIS_MANTRA` above: that trigger is OPTIONAL, so the
 * life only arrives if the player accepts, and this one fires on the
 * `LifeChanged` the other script emitted. Two real cards, one bus.
 */
export const AJANIS_PRIDEMATE: CardScript = {
  oracleId: AJANI_S_PRIDEMATE.oracleId,
  name: AJANI_S_PRIDEMATE.name,
  triggers: [
    {
      abilityId: 'lifegain',
      text: PRIDEMATE_TEXT,
      event: 'LifeChanged',
      activeZones: ['battlefield'],
      optional: false,
      // "Whenever YOU gain life" — the controller, and a GAIN, so paying life
      // and Scar's controller losing it are both correctly ignored.
      matches: (ctx, self, ev) =>
        ev.t === 'LifeChanged' && ev.delta > 0 && ev.player === ctx.query.controllerOf(self),
      label: () => "Ajani's Pridemate — +1/+1 counter",
      resolve: (ctx, self): readonly EventBody[] =>
        // ⚠️ Re-checked at RESOLUTION, not trusted from trigger time. The
        // creature can be gone by now — CR 603.2 puts the ability on the stack
        // independently of its source — and a `CountersChanged` naming a card in
        // a graveyard is a number nothing reads.
        ctx.state.cards[self]?.zone.kind === 'battlefield'
          ? [{ t: 'CountersChanged', changes: [{ card: self, kind: '+1/+1', delta: 1 }] }]
          : [],
    },
  ],
};

/**
 * `Yotian Dissident` — `{G}{W}` 1/1, "Whenever an artifact you control enters,
 * put a +1/+1 counter on target creature you control."
 *
 * ⚠️ **THE FIRST TRIGGER IN THIS PROJECT THAT TARGETS.** Until D147 a
 * `TriggerDef` had no way to declare targets, `PendingTrigger` carried none and
 * `drainTriggers` built every stack object with `targets: []` — so all 3,218
 * Commander-legal cards whose triggered ability names a target were
 * unscriptable, however simple the rest of the card was.
 *
 * ⚠️ Its target is RESTRICTED, and that is the point. "target creature" — the
 * commonest wording at 926 lines — would pass this test with `targetAllowed`
 * never consulted, because every creature on the board is legal for it. "you
 * control" is the smallest restriction that makes the check observable.
 *
 * ⚠️ The effect needs NOTHING new: `CountersChanged` has been on the log since
 * D107. One primitive per proof (D130's correction, where a whole row turned
 * out to have been scriptable all along).
 */
export const YOTIAN_DISSIDENT_SCRIPT: CardScript = {
  oracleId: YOTIAN_DISSIDENT.oracleId,
  name: YOTIAN_DISSIDENT.name,
  triggers: [
    {
      abilityId: 'artifact-etb',
      text: YOTIAN_TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: YOTIAN_TARGETS,
      // "an ARTIFACT YOU CONTROL enters" — the mover must land on the
      // battlefield, be an artifact, and be this permanent's controller's.
      // ⚠️ `derive`, not the printed type line: an artifact by layer 4 is an
      // artifact, and reading the printing would miss every animated one.
      matches: (ctx, self, ev) => {
        if (ev.t !== 'CardsMoved') return false;
        const mine = ctx.query.controllerOf(self);
        return ev.moves.some((m) => {
          if (m.to.kind !== 'battlefield') return false;
          const card = ctx.state.cards[m.card];
          if (!card || card.controller !== mine) return false;
          return ctx.derive(m.card).typeLine.types.includes('Artifact');
        });
      },
      label: () => 'Yotian Dissident — +1/+1 counter on target creature you control',
      // ⚠️ THE TARGET IS READ OFF THE STACK OBJECT, which is where CR 603.3d put
      // it when the ability went on the stack — and where CR 608.2b re-checked
      // it a moment ago. A script that re-picked here would be choosing on the
      // player's behalf, one prompt too late.
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind === 'player') return [];
        // Re-checked at resolution for the same reason `AJANIS_PRIDEMATE` does:
        // CR 603.2 puts the ability on the stack independently of its source,
        // and a `CountersChanged` naming a card in a graveyard is a number
        // nothing reads.
        return ctx.state.cards[target.id]?.zone.kind === 'battlefield'
          ? [{ t: 'CountersChanged', changes: [{ card: target.id, kind: '+1/+1', delta: 1 }] }]
          : [];
      },
    },
  ],
};

// ⚠️ `Onulet` LIVED HERE from D147 to D158 and now ships for real —
// `src/engine/scripts/cards/onulet.ts`, registered in `SHIPPED_SCRIPTS`. One
// card, one script: the tests that drove this copy import the shipped one now.
// (The shipped `resolve` also fixed a latent wrongness this copy carried: it
// read the dead card's OWNER where "you" means the controller AS IT DIED —
// `obj.controller` — which differs exactly when the creature was stolen.)

/**
 * `Spineless Thug` — `{1}{B}` 2/2, "This creature can't block."
 *
 * ⚠️ **THE FIRST COMBAT RESTRICTION, and the seam for it did not exist** until
 * D147. D129 filed 227 cards under the `layer6` bucket because text like this
 * reads as a static ability — and then found that `canAttack` and `canBlock`
 * consult no static at all, so the engine could not express "can't block"
 * however the script was written. `CombatDef` is that seam.
 *
 * ⚠️ **"CAN'T BLOCK" RATHER THAN "CAN'T ATTACK", DELIBERATELY.** `canAttack`
 * already refuses a creature for six built-in reasons — tapped, phased out, not
 * yours, not a creature, defender, summoning sickness — so a test of a
 * can't-attack script could pass with the new seam never consulted at all.
 * Nothing else in these fixtures stops a 2/2 blocking, so the refusal here can
 * only have come from this def.
 */
export const SPINELESS_THUG_SCRIPT: CardScript = {
  oracleId: SPINELESS_THUG.oracleId,
  name: SPINELESS_THUG.name,
  combat: [
    {
      abilityId: 'cant-block',
      text: THUG_TEXT,
      activeZones: ['battlefield'],
      // ⚠️ ONLY ITSELF. `canBlock` is asked about every pair on the board, and a
      // def that forgot this comparison would stop EVERY creature blocking —
      // which is what an anthem-shaped restriction legitimately does, and what
      // this card most certainly does not.
      canBlock: (_ctx, self, blocker) => blocker !== self,
    },
  ],
};

// ── CR 616: the pair that makes ORDER matter (D148) ─────────────────────────
//
// ⚠️ These moved here from `replacements.test.ts` when D148 made the ordering a
// PLAYER CHOICE: the fuzz gate needs them, and a test file is not a home two
// other files can import from. Two counters become SIX applying Scales first and
// FIVE the other way round, from the same board — which is the whole reason
// CR 616 is a rule and not a tie-break.
/** "…that many plus one +1/+1 counters are put on it instead." */
export const HARDENED_SCALES_SCRIPT: CardScript = {
  oracleId: HARDENED_SCALES.oracleId,
  name: HARDENED_SCALES.name,
  replacements: [
    {
      abilityId: 'scales',
      text: HARDENED_SCALES.faces[0]?.oracleText ?? '',
      activeZones: ['battlefield'],
      applies: (ctx, self, ev) =>
        ev.t === 'CountersChanged' &&
        ev.changes.some(
          (c) =>
            c.kind === '+1/+1' &&
            c.delta > 0 &&
            ctx.state.cards[c.card]?.controller === ctx.query.controllerOf(self),
        ),
      replace: (ctx, self, ev): readonly EventBody[] => {
        if (ev.t !== 'CountersChanged') return [ev];
        const me = ctx.query.controllerOf(self);
        return [
          {
            t: 'CountersChanged',
            changes: ev.changes.map((c) =>
              c.kind === '+1/+1' && c.delta > 0 && ctx.state.cards[c.card]?.controller === me
                ? { ...c, delta: c.delta + 1 }
                : c,
            ),
          },
        ];
      },
    },
  ],
};

/** "…twice that many +1/+1 counters are put on that creature instead." */
export const BRANCHING_EVOLUTION_SCRIPT: CardScript = {
  oracleId: BRANCHING_EVOLUTION.oracleId,
  name: BRANCHING_EVOLUTION.name,
  replacements: [
    {
      abilityId: 'evolution',
      text: BRANCHING_EVOLUTION.faces[0]?.oracleText ?? '',
      activeZones: ['battlefield'],
      applies: (ctx, self, ev) =>
        ev.t === 'CountersChanged' &&
        ev.changes.some(
          (c) =>
            c.kind === '+1/+1' &&
            c.delta > 0 &&
            ctx.state.cards[c.card]?.controller === ctx.query.controllerOf(self),
        ),
      replace: (ctx, self, ev): readonly EventBody[] => {
        if (ev.t !== 'CountersChanged') return [ev];
        const me = ctx.query.controllerOf(self);
        return [
          {
            t: 'CountersChanged',
            changes: ev.changes.map((c) =>
              c.kind === '+1/+1' && c.delta > 0 && ctx.state.cards[c.card]?.controller === me
                ? { ...c, delta: c.delta * 2 }
                : c,
            ),
          },
        ];
      },
    },
  ],
};


// ── CR 613.8: the DEPENDENCY pair (D149) ─────────────────────────────────────
//
// ⚠️ Both LAYER 6, and neither shows the rule alone. `Kwende` DEPENDS on
// `Knighthood`: whether it applies to a creature is decided by whether
// Knighthood has already granted that creature first strike. In plain timestamp
// order with Kwende first, a vanilla creature ends with first strike and NO
// double strike — the card doing nothing at all, silently, on a board where it
// plainly should.

const KNIGHTHOOD_TEXT = printed(KNIGHTHOOD, 'Creatures you control have first strike.');
/**
 * ⚠️ **KWENDE HAS DOUBLE STRIKE HIMSELF**, so his printed text is TWO lines and
 * the first is a keyword the engine already enforces. The `printed()` guard
 * caught that on the first run — which is exactly what it is for: a script
 * written for a sentence the card does not have would otherwise run happily and
 * wrongly, forever.
 *
 * ⚠️ So the static claims the SECOND line only, and the first is covered by
 * `keywords`. That is not a licence to run part of a card (D90): the keyword
 * line IS run, by the Tier-2 machinery, so the whole card is accounted for
 * between the two.
 */
const KWENDE_PRINTED = printed(
  KWENDE_PRIDE_OF_FEMEREF,
  'Double strike\nCreatures you control with first strike have double strike.',
);
const KWENDE_TEXT = KWENDE_PRINTED.split('\n')[1] as string;

/** `Knighthood` — `{2}{W}` Enchantment, and its whole text is the grant. */
export const KNIGHTHOOD_SCRIPT: CardScript = {
  oracleId: KNIGHTHOOD.oracleId,
  name: KNIGHTHOOD.name,
  statics: [
    {
      abilityId: 'first-strike',
      text: KNIGHTHOOD_TEXT,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => {
        const source = ctx.state.cards[self];
        const target = ctx.state.cards[candidate];
        if (!source || !target || target.zone.kind !== 'battlefield') return false;
        if (target.controller !== source.controller) return false;
        return chars.typeLine.types.includes('Creature');
      },
      modify: (chars) => {
        chars.keywords.add('firstStrike');
      },
    },
  ],
};

/**
 * `Kwende, Pride of Femeref` — `{2}{W}{W}` 3/3, "Creatures you control with
 * first strike have double strike."
 *
 * ⚠️ **THE SCOPE READS A KEYWORD, which is what makes it depend on anything.**
 * `chars.keywords.has('firstStrike')` is the whole clause, and `chars` is the
 * candidate's characteristics AS THE LAYERS HAVE BUILT THEM SO FAR — so the
 * answer genuinely changes with what has already been applied. That is CR
 * 613.8a's "applying the other would change … what it applies to", in one line.
 */
export const KWENDE_SCRIPT: CardScript = {
  oracleId: KWENDE_PRIDE_OF_FEMEREF.oracleId,
  name: KWENDE_PRIDE_OF_FEMEREF.name,
  statics: [
    {
      abilityId: 'double-strike',
      text: KWENDE_TEXT,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => {
        const source = ctx.state.cards[self];
        const target = ctx.state.cards[candidate];
        if (!source || !target || target.zone.kind !== 'battlefield') return false;
        if (target.controller !== source.controller) return false;
        if (!chars.typeLine.types.includes('Creature')) return false;
        return chars.keywords.has('firstStrike');
      },
      modify: (chars) => {
        chars.keywords.add('doubleStrike');
      },
    },
  ],
};

// ── the card that was unrepresentable (D151) ─────────────────────────────────

const HUMILITY_TEXT = printed(
  HUMILITY,
  'All creatures lose all abilities and have base power and toughness 1/1.',
);

/**
 * `Humility` — `{2}{W}{W}` Enchantment, "All creatures lose all abilities and
 * have base power and toughness 1/1."
 *
 * ⚠️ **THIS CARD WAS NAMED AS UNREPRESENTABLE FIVE TIMES** — D129, D147, D148,
 * D149 and D150 each closed by saying `MutableCharacteristics` models KEYWORDS,
 * so an effect removing a non-keyword ability could not be written at all. It
 * can now: `chars.hasAbilities` is the representation, and `derive` plus the
 * four registry consult sites are what make it mean something.
 *
 * ⚠️ **TWO STATICS, BECAUSE IT IS TWO LAYERS.** "Lose all abilities" is layer 6
 * and "base power and toughness 1/1" is layer 7b, and CR applies them in that
 * order regardless of how the sentence reads. One def doing both would be a
 * layer violation dressed as convenience — and it would break the moment
 * anything else touched either layer.
 *
 * ⚠️ **ALL creatures, including its controller's and including a creature that
 * is itself an ability-removal source.** `Humility` is an enchantment, so it
 * never silences itself; that is the case the recursion guard in `triggers.ts`
 * relies on, and it holds for every printed card.
 */
export const HUMILITY_SCRIPT: CardScript = {
  oracleId: HUMILITY.oracleId,
  name: HUMILITY.name,
  statics: [
    {
      abilityId: 'lose-abilities',
      text: HUMILITY_TEXT,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, _self, candidate, chars) =>
        ctx.state.cards[candidate]?.zone.kind === 'battlefield' &&
        chars.typeLine.types.includes('Creature'),
      modify: (chars) => {
        // ⚠️ The FLAG, not `keywords.clear()`. Clearing the set says nothing
        // about the triggered, static, replacement and activated abilities that
        // live in the registry — and `finish()` is the one place that turns this
        // into every consequence, so a script never has to remember them.
        chars.hasAbilities = false;
      },
    },
    {
      abilityId: 'base-pt',
      text: HUMILITY_TEXT,
      layer: 'ptSet',
      activeZones: ['battlefield'],
      appliesTo: (ctx, _self, candidate, chars) =>
        ctx.state.cards[candidate]?.zone.kind === 'battlefield' &&
        chars.typeLine.types.includes('Creature'),
      modify: (chars) => {
        chars.power = 1;
        chars.toughness = 1;
      },
    },
  ],
};
