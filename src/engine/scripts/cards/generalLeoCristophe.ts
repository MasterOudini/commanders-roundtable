// `General Leo Cristophe` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GENERAL_LEO_CRISTOPHE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GENERAL_LEO_CRISTOPHE, "When General Leo Cristophe enters, return up to one target creature card with mana value 3 or less from your graveyard to the battlefield. Then put a +1/+1 counter on General Leo Cristophe for each creature you control.");

const VOCAB_L0 = vocabularyEffects("Return up to one target creature card with mana value 3 or less from your graveyard to the battlefield. Then put a +1/+1 counter on ~ for each creature you control.", GENERAL_LEO_CRISTOPHE.name);
const VOCAB_T_L0 = vocabularyTargets("Return up to one target creature card with mana value 3 or less from your graveyard to the battlefield. Then put a +1/+1 counter on ~ for each creature you control.");

export const GENERAL_LEO_CRISTOPHE_SCRIPT: CardScript = {
  oracleId: GENERAL_LEO_CRISTOPHE.oracleId,
  name: GENERAL_LEO_CRISTOPHE.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "General Leo Cristophe - Return up to one target creature card with mana value 3 or less from your graveyard to the battlefield. Then put a +1/+1 counter on ~ for each creature you control.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
