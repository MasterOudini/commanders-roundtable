// `Doc Ock's Henchmen` - a attacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DOC_OCK_S_HENCHMEN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DOC_OCK_S_HENCHMEN, "Flash\nWhenever this creature attacks, it connives. (Draw a card, then discard a card. If you discarded a nonland card, put a +1/+1 counter on this creature.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("~ connives.", DOC_OCK_S_HENCHMEN.name);
const VOCAB_T_L1 = vocabularyTargets("~ connives.");

export const DOC_OCKS_HENCHMEN_SCRIPT: CardScript = {
  oracleId: DOC_OCK_S_HENCHMEN.oracleId,
  name: DOC_OCK_S_HENCHMEN.name,
  triggers: [
    {
      abilityId: 'attacks-1',
      text: LINES[1] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Doc Ock's Henchmen - ~ connives.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
