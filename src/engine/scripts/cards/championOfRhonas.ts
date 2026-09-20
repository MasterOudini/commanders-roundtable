// `Champion of Rhonas` - a exertAttack trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CHAMPION_OF_RHONAS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CHAMPION_OF_RHONAS, "You may exert this creature as it attacks. When you do, you may put a creature card from your hand onto the battlefield. (An exerted creature won't untap during your next untap step.)");

const VOCAB_L0 = vocabularyEffects("Put a creature card from your hand onto the battlefield.", CHAMPION_OF_RHONAS.name);
const VOCAB_T_L0 = vocabularyTargets("Put a creature card from your hand onto the battlefield.");

export const CHAMPION_OF_RHONAS_SCRIPT: CardScript = {
  oracleId: CHAMPION_OF_RHONAS.oracleId,
  name: CHAMPION_OF_RHONAS.name,
  triggers: [
    {
      abilityId: 'exertAttack-0',
      text: PRINTED,
      event: 'Exerted',
      activeZones: ['battlefield'],
      optional: true,
      matches: (_ctx, self, ev) => ev.t === 'Exerted' && ev.card === self,
      label: () => "Champion of Rhonas - Put a creature card from your hand onto the battlefield.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
