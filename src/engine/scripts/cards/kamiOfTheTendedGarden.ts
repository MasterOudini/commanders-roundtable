// `Kami of the Tended Garden` - a upkeep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KAMI_OF_THE_TENDED_GARDEN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KAMI_OF_THE_TENDED_GARDEN, "At the beginning of your upkeep, sacrifice this creature unless you pay {G}.\nSoulshift 3 (When this creature dies, you may return target Spirit card with mana value 3 or less from your graveyard to your hand.)");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Sacrifice this creature unless you pay {G}.", KAMI_OF_THE_TENDED_GARDEN.name);
const VOCAB_T_L0 = vocabularyTargets("Sacrifice this creature unless you pay {G}.");

export const KAMI_OF_THE_TENDED_GARDEN_SCRIPT: CardScript = {
  oracleId: KAMI_OF_THE_TENDED_GARDEN.oracleId,
  name: KAMI_OF_THE_TENDED_GARDEN.name,
  triggers: [
    {
      abilityId: 'upkeep-0',
      text: LINES[0] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Kami of the Tended Garden - Sacrifice this creature unless you pay {G}.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
