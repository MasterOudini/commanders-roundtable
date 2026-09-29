// `Gastal Blockbuster` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GASTAL_BLOCKBUSTER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GASTAL_BLOCKBUSTER, "When this creature enters, you may sacrifice a creature or Vehicle. When you do, destroy target artifact an opponent controls.");

const VOCAB_L0 = vocabularyEffects("You may sacrifice a creature or Vehicle. When you do, destroy target artifact an opponent controls.", GASTAL_BLOCKBUSTER.name);
const VOCAB_T_L0 = vocabularyTargets("You may sacrifice a creature or Vehicle. When you do, destroy target artifact an opponent controls.");

export const GASTAL_BLOCKBUSTER_SCRIPT: CardScript = {
  oracleId: GASTAL_BLOCKBUSTER.oracleId,
  name: GASTAL_BLOCKBUSTER.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Gastal Blockbuster - You may sacrifice a creature or Vehicle. When you do, destroy target artifact an opponent controls.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
