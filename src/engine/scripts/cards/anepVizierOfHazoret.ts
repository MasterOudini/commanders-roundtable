// `Anep, Vizier of Hazoret` - a exertAttack trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ANEP_VIZIER_OF_HAZORET } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ANEP_VIZIER_OF_HAZORET, "Trample\nYou may exert Anep as it attacks. When you do, exile the top two cards of your library. Until the end of your next turn, you may play those cards. (An exerted creature won't untap during your next untap step.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Exile the top two cards of your library. Until the end of your next turn, you may play those cards.", ANEP_VIZIER_OF_HAZORET.name);
const VOCAB_T_L1 = vocabularyTargets("Exile the top two cards of your library. Until the end of your next turn, you may play those cards.");

export const ANEP_VIZIER_OF_HAZORET_SCRIPT: CardScript = {
  oracleId: ANEP_VIZIER_OF_HAZORET.oracleId,
  name: ANEP_VIZIER_OF_HAZORET.name,
  triggers: [
    {
      abilityId: 'exertAttack-1',
      text: LINES[1] as string,
      event: 'Exerted',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'Exerted' && ev.card === self,
      label: () => "Anep, Vizier of Hazoret - Exile the top two cards of your library. Until the end of your next turn, you may play those cards.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
