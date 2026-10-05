// `Arena Rector` - a dies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ARENA_RECTOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ARENA_RECTOR, "When this creature dies, you may exile it. If you do, search your library for a planeswalker card, put it onto the battlefield, then shuffle.");

const VOCAB_L0 = vocabularyEffects("You may exile it. If you do, search your library for a planeswalker card, put it onto the battlefield, then shuffle.", ARENA_RECTOR.name);
const VOCAB_T_L0 = vocabularyTargets("You may exile it. If you do, search your library for a planeswalker card, put it onto the battlefield, then shuffle.");

export const ARENA_RECTOR_SCRIPT: CardScript = {
  oracleId: ARENA_RECTOR.oracleId,
  name: ARENA_RECTOR.name,
  triggers: [
    {
      abilityId: 'dies-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => "Arena Rector - You may exile it. If you do, search your library for a planeswalker card, put it onto the battlefield, then shuffle.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
