// `Atlantean Skirmisher` - a attacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ATLANTEAN_SKIRMISHER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ATLANTEAN_SKIRMISHER, "Whenever this creature attacks, it connives. (Draw a card, then discard a card. If you discarded a nonland card, put a +1/+1 counter on this creature.)");

const VOCAB_L0 = vocabularyEffects("~ connives.", ATLANTEAN_SKIRMISHER.name);
const VOCAB_T_L0 = vocabularyTargets("~ connives.");

export const ATLANTEAN_SKIRMISHER_SCRIPT: CardScript = {
  oracleId: ATLANTEAN_SKIRMISHER.oracleId,
  name: ATLANTEAN_SKIRMISHER.name,
  triggers: [
    {
      abilityId: 'attacks-0',
      text: PRINTED,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Atlantean Skirmisher - ~ connives.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
