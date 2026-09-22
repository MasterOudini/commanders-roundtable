// `Enraged Huorn` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ENRAGED_HUORN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ENRAGED_HUORN, "Trample\nWhen this creature enters, the Ring tempts you.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("The Ring tempts you.", ENRAGED_HUORN.name);
const VOCAB_T_L1 = vocabularyTargets("The Ring tempts you.");

export const ENRAGED_HUORN_SCRIPT: CardScript = {
  oracleId: ENRAGED_HUORN.oracleId,
  name: ENRAGED_HUORN.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Enraged Huorn - The Ring tempts you.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
