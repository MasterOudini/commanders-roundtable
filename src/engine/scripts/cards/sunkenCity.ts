// `Sunken City` - a upkeep trigger vocab, a static anthem
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SUNKEN_CITY } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

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

const PRINTED = printed(SUNKEN_CITY, "At the beginning of your upkeep, sacrifice this enchantment unless you pay {U}{U}.\nBlue creatures get +1/+1.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Sacrifice this enchantment unless you pay {U}{U}.", SUNKEN_CITY.name);
const VOCAB_T_L0 = vocabularyTargets("Sacrifice this enchantment unless you pay {U}{U}.");

export const SUNKEN_CITY_SCRIPT: CardScript = {
  oracleId: SUNKEN_CITY.oracleId,
  name: SUNKEN_CITY.name,
  triggers: [
    {
      abilityId: 'upkeep-0',
      text: LINES[0] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Sunken City - Sacrifice this enchantment unless you pay {U}{U}.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
  statics: [
    {
      abilityId: 'anthem-pt-1',
      text: LINES[1] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, _self, candidate, chars) => chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && chars.colors.includes("U"),
      modify: (chars) => {
        if (chars.power !== null) chars.power += 1;
        if (chars.toughness !== null) chars.toughness += 1;
      },
    },
  ],
};
