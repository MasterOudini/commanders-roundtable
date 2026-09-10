// `Fleeting Aven` - a aPlayerCycles trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FLEETING_AVEN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FLEETING_AVEN, "Flying\nWhenever a player cycles a card, return this creature to its owner's hand.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Return this creature to its owner's hand.", FLEETING_AVEN.name);
const VOCAB_T_L1 = vocabularyTargets("Return this creature to its owner's hand.");

export const FLEETING_AVEN_SCRIPT: CardScript = {
  oracleId: FLEETING_AVEN.oracleId,
  name: FLEETING_AVEN.name,
  triggers: [
    {
      abilityId: 'aPlayerCycles-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, _self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.reason === 'cycling' && m.from.kind === 'hand',
        ),
      label: () => "Fleeting Aven - Return this creature to its owner's hand.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
