// `Ravos, Soultender` - a static anthem, a upkeep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RAVOS_SOULTENDER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RAVOS_SOULTENDER, "Flying\nOther creatures you control get +1/+1.\nAt the beginning of your upkeep, you may return target creature card from your graveyard to your hand.\nPartner (You can have two commanders if both have partner.)");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Return target creature card from your graveyard to your hand.", RAVOS_SOULTENDER.name);
const VOCAB_T_L2 = vocabularyTargets("Return target creature card from your graveyard to your hand.");

export const RAVOS_SOULTENDER_SCRIPT: CardScript = {
  oracleId: RAVOS_SOULTENDER.oracleId,
  name: RAVOS_SOULTENDER.name,
  triggers: [
    {
      abilityId: 'upkeep-2',
      text: LINES[2] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: true,
      targets: VOCAB_T_L2,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Ravos, Soultender - Return target creature card from your graveyard to your hand.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
  statics: [
    {
      abilityId: 'anthem-pt-1',
      text: LINES[1] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => candidate !== self && chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
      modify: (chars) => {
        if (chars.power !== null) chars.power += 1;
        if (chars.toughness !== null) chars.toughness += 1;
      },
    },
  ],
};
