// `Fireblade Artist` - a upkeep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FIREBLADE_ARTIST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FIREBLADE_ARTIST, "Haste\nAt the beginning of your upkeep, you may sacrifice a creature. When you do, this creature deals 2 damage to target opponent or planeswalker.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("You may sacrifice a creature. When you do, this creature deals 2 damage to target opponent or planeswalker.", FIREBLADE_ARTIST.name);
const VOCAB_T_L1 = vocabularyTargets("You may sacrifice a creature. When you do, this creature deals 2 damage to target opponent or planeswalker.");

export const FIREBLADE_ARTIST_SCRIPT: CardScript = {
  oracleId: FIREBLADE_ARTIST.oracleId,
  name: FIREBLADE_ARTIST.name,
  triggers: [
    {
      abilityId: 'upkeep-1',
      text: LINES[1] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Fireblade Artist - You may sacrifice a creature. When you do, this creature deals 2 damage to target opponent or planeswalker.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
