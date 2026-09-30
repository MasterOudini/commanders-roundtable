// `Biting Tether` - a upkeep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BITING_TETHER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BITING_TETHER, "Enchant creature\nYou control enchanted creature.\nAt the beginning of your upkeep, put a -1/-1 counter on enchanted creature.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Put a -1/-1 counter on enchanted creature.", BITING_TETHER.name);
const VOCAB_T_L2 = vocabularyTargets("Put a -1/-1 counter on enchanted creature.");

export const BITING_TETHER_SCRIPT: CardScript = {
  oracleId: BITING_TETHER.oracleId,
  name: BITING_TETHER.name,
  triggers: [
    {
      abilityId: 'upkeep-2',
      text: LINES[2] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Biting Tether - Put a -1/-1 counter on enchanted creature.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
