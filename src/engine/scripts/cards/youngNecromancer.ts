// `Young Necromancer` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { YOUNG_NECROMANCER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(YOUNG_NECROMANCER, "When this creature enters, you may exile two cards from your graveyard. When you do, return target creature card from your graveyard to the battlefield.");

const VOCAB_L0 = vocabularyEffects("You may exile two cards from your graveyard. When you do, return target creature card from your graveyard to the battlefield.", YOUNG_NECROMANCER.name);
const VOCAB_T_L0 = vocabularyTargets("You may exile two cards from your graveyard. When you do, return target creature card from your graveyard to the battlefield.");

export const YOUNG_NECROMANCER_SCRIPT: CardScript = {
  oracleId: YOUNG_NECROMANCER.oracleId,
  name: YOUNG_NECROMANCER.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Young Necromancer - You may exile two cards from your graveyard. When you do, return target creature card from your graveyard to the battlefield.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
