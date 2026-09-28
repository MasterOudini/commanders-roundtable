// `Ulvenwald Oddity // Ulvenwald Behemoth` - an activation vocab, a static anthem
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ULVENWALD_ODDITY_ULVENWALD_BEHEMOTH } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { transformFrom, vocabularyEffects, vocabularyTargets } from '../vocabulary';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

function printed(card: CardData, expected: string): string {
  const actual = card.faces.map((f) => f.oracleText ?? '').join('\n');
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(ULVENWALD_ODDITY_ULVENWALD_BEHEMOTH, "Trample, haste\n{5}{G}{G}: Transform this creature.\nTrample, haste\nOther creatures you control get +1/+1 and have trample and haste.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = transformFrom(vocabularyEffects("Transform this creature.", ULVENWALD_ODDITY_ULVENWALD_BEHEMOTH.name), 0);
const VOCAB_T_A0 = vocabularyTargets("Transform this creature.");

export const ULVENWALD_ODDITY_ULVENWALD_BEHEMOTH_SCRIPT: CardScript = {
  oracleId: ULVENWALD_ODDITY_ULVENWALD_BEHEMOTH.oracleId,
  name: ULVENWALD_ODDITY_ULVENWALD_BEHEMOTH.name,
  activated: [
    {
      ref: `${ULVENWALD_ODDITY_ULVENWALD_BEHEMOTH.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  statics: [
    {
      abilityId: 'anthem-pt-3', face: 1,
      text: LINES[3] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => candidate !== self && chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
      modify: (chars) => {
        if (chars.power !== null) chars.power += 1;
        if (chars.toughness !== null) chars.toughness += 1;
      },
    },
    {
      abilityId: 'anthem-grant-3', face: 1,
      text: LINES[3] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => candidate !== self && chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
      modify: (chars) => {
        chars.keywords.add("trample");
        chars.keywords.add("haste");
      },
    },
  ],
};
