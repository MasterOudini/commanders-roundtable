// `Faith of the Devoted` - a youDiscard trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FAITH_OF_THE_DEVOTED } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FAITH_OF_THE_DEVOTED, "Whenever you cycle or discard a card, you may pay {1}. If you do, each opponent loses 2 life and you gain 2 life.");

const VOCAB_L0 = vocabularyEffects("You may pay {1}. If you do, each opponent loses 2 life and you gain 2 life.", FAITH_OF_THE_DEVOTED.name);
const VOCAB_T_L0 = vocabularyTargets("You may pay {1}. If you do, each opponent loses 2 life and you gain 2 life.");

export const FAITH_OF_THE_DEVOTED_SCRIPT: CardScript = {
  oracleId: FAITH_OF_THE_DEVOTED.oracleId,
  name: FAITH_OF_THE_DEVOTED.name,
  triggers: [
    {
      abilityId: 'youDiscard-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => (m.reason === 'cycling' || m.reason === 'discard') && m.from.kind === 'hand' && m.from.player === ctx.query.controllerOf(self),
        ),
      label: () => "Faith of the Devoted - You may pay {1}. If you do, each opponent loses 2 life and you gain 2 life.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
