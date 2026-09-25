// `Weftblade Enhancer` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WEFTBLADE_ENHANCER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WEFTBLADE_ENHANCER, "When this creature enters, put a +1/+1 counter on each of up to two target creatures.\nWarp {2}{W} (You may cast this card from your hand for its warp cost. Exile this creature at the beginning of the next end step, then you may cast it from exile on a later turn.)");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Put a +1/+1 counter on each of up to two target creatures.", WEFTBLADE_ENHANCER.name);
const VOCAB_T_L0 = vocabularyTargets("Put a +1/+1 counter on each of up to two target creatures.");

export const WEFTBLADE_ENHANCER_SCRIPT: CardScript = {
  oracleId: WEFTBLADE_ENHANCER.oracleId,
  name: WEFTBLADE_ENHANCER.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Weftblade Enhancer - Put a +1/+1 counter on each of up to two target creatures.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
