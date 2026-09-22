// `The Tabernacle at Pendrell Vale` - a static anthem, a upkeep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { THE_TABERNACLE_AT_PENDRELL_VALE } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { grantedTriggerRef } from '../grants';
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

const PRINTED = printed(THE_TABERNACLE_AT_PENDRELL_VALE, "All creatures have \"At the beginning of your upkeep, destroy this creature unless you pay {1}.\"");

const VOCAB_L0 = vocabularyEffects("Destroy ~ unless you pay {1}.", THE_TABERNACLE_AT_PENDRELL_VALE.name);
const VOCAB_T_L0 = vocabularyTargets("Destroy ~ unless you pay {1}.");

const GRANT_0 = grantedTriggerRef(`${THE_TABERNACLE_AT_PENDRELL_VALE.oracleId}#gt0`, THE_TABERNACLE_AT_PENDRELL_VALE.name);

export const THE_TABERNACLE_AT_PENDRELL_VALE_SCRIPT: CardScript = {
  oracleId: THE_TABERNACLE_AT_PENDRELL_VALE.oracleId,
  name: THE_TABERNACLE_AT_PENDRELL_VALE.name,
  triggers: [
    {
      abilityId: 'gt0',
      text: PRINTED,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "The Tabernacle at Pendrell Vale - Destroy ~ unless you pay {1}.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
  statics: [
    {
      abilityId: 'anthem-grant-0',
      text: PRINTED,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, _self, candidate, chars) => chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && chars.typeLine.types.includes("Creature"),
      modify: (chars, _ctx, self) => {
        chars.grantedTriggered.push({ provider: self, ref: GRANT_0 });
      },
    },
  ],
};
