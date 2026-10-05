// `Llanowar Sentinel` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LLANOWAR_SENTINEL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LLANOWAR_SENTINEL, "When this creature enters, you may pay {1}{G}. If you do, search your library for a card named Llanowar Sentinel, put that card onto the battlefield, then shuffle.");

const VOCAB_L0 = vocabularyEffects("You may pay {1}{G}. If you do, search your library for a card named ~, put that card onto the battlefield, then shuffle.", LLANOWAR_SENTINEL.name);
const VOCAB_T_L0 = vocabularyTargets("You may pay {1}{G}. If you do, search your library for a card named ~, put that card onto the battlefield, then shuffle.");

export const LLANOWAR_SENTINEL_SCRIPT: CardScript = {
  oracleId: LLANOWAR_SENTINEL.oracleId,
  name: LLANOWAR_SENTINEL.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Llanowar Sentinel - You may pay {1}{G}. If you do, search your library for a card named ~, put that card onto the battlefield, then shuffle.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
