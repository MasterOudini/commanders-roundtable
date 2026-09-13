// `Soul Net` - a aCreatureDies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SOUL_NET } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SOUL_NET, "Whenever a creature dies, you may pay {1}. If you do, you gain 1 life.");

const VOCAB_L0 = vocabularyEffects("You may pay {1}. If you do, you gain 1 life.", SOUL_NET.name);
const VOCAB_T_L0 = vocabularyTargets("You may pay {1}. If you do, you gain 1 life.");

export const SOUL_NET_SCRIPT: CardScript = {
  oracleId: SOUL_NET.oracleId,
  name: SOUL_NET.name,
  triggers: [
    {
      abilityId: 'aCreatureDies-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, _self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some((m) => m.from.kind === 'battlefield' && m.to.kind === 'graveyard' && ctx.derive(m.card).typeLine.types.includes('Creature')),
      label: () => "Soul Net - You may pay {1}. If you do, you gain 1 life.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
