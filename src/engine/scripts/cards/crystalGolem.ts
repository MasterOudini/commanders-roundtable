// `Crystal Golem` - a endStep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CRYSTAL_GOLEM } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CRYSTAL_GOLEM, "At the beginning of your end step, this creature phases out. (While it's phased out, it's treated as though it doesn't exist. It phases in before you untap during your next untap step.)");

const VOCAB_L0 = vocabularyEffects("~ phases out.", CRYSTAL_GOLEM.name);
const VOCAB_T_L0 = vocabularyTargets("~ phases out.");

export const CRYSTAL_GOLEM_SCRIPT: CardScript = {
  oracleId: CRYSTAL_GOLEM.oracleId,
  name: CRYSTAL_GOLEM.name,
  triggers: [
    {
      abilityId: 'endStep-0',
      text: PRINTED,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'end' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Crystal Golem - ~ phases out.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
