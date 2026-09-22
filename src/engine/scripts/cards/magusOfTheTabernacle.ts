// `Magus of the Tabernacle` - a static anthem, a upkeep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MAGUS_OF_THE_TABERNACLE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MAGUS_OF_THE_TABERNACLE, "All creatures have \"At the beginning of your upkeep, sacrifice this creature unless you pay {1}.\"");

const VOCAB_L0 = vocabularyEffects("Sacrifice ~ unless you pay {1}.", MAGUS_OF_THE_TABERNACLE.name);
const VOCAB_T_L0 = vocabularyTargets("Sacrifice ~ unless you pay {1}.");

const GRANT_0 = grantedTriggerRef(`${MAGUS_OF_THE_TABERNACLE.oracleId}#gt0`, MAGUS_OF_THE_TABERNACLE.name);

export const MAGUS_OF_THE_TABERNACLE_SCRIPT: CardScript = {
  oracleId: MAGUS_OF_THE_TABERNACLE.oracleId,
  name: MAGUS_OF_THE_TABERNACLE.name,
  triggers: [
    {
      abilityId: 'gt0',
      text: PRINTED,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Magus of the Tabernacle - Sacrifice ~ unless you pay {1}.",
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
