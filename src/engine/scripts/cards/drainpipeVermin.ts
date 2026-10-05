// `Drainpipe Vermin` - a dies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DRAINPIPE_VERMIN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DRAINPIPE_VERMIN, "When this creature dies, you may pay {B}. If you do, target player discards a card.");

const VOCAB_L0 = vocabularyEffects("You may pay {B}. If you do, target player discards a card.", DRAINPIPE_VERMIN.name);
const VOCAB_T_L0 = vocabularyTargets("You may pay {B}. If you do, target player discards a card.");

export const DRAINPIPE_VERMIN_SCRIPT: CardScript = {
  oracleId: DRAINPIPE_VERMIN.oracleId,
  name: DRAINPIPE_VERMIN.name,
  triggers: [
    {
      abilityId: 'dies-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => "Drainpipe Vermin - You may pay {B}. If you do, target player discards a card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
