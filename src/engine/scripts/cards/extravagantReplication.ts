// `Extravagant Replication` - a upkeep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { EXTRAVAGANT_REPLICATION } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(EXTRAVAGANT_REPLICATION, "At the beginning of your upkeep, create a token that's a copy of another target nonland permanent you control.");

const VOCAB_L0 = vocabularyEffects("Create a token that's a copy of another target nonland permanent you control.", EXTRAVAGANT_REPLICATION.name);
const VOCAB_T_L0 = vocabularyTargets("Create a token that's a copy of another target nonland permanent you control.");

export const EXTRAVAGANT_REPLICATION_SCRIPT: CardScript = {
  oracleId: EXTRAVAGANT_REPLICATION.oracleId,
  name: EXTRAVAGANT_REPLICATION.name,
  triggers: [
    {
      abilityId: 'upkeep-0',
      text: PRINTED,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Extravagant Replication - Create a token that's a copy of another target nonland permanent you control.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
