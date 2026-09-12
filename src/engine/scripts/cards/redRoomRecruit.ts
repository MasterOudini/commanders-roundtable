// `Red Room Recruit` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RED_ROOM_RECRUIT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RED_ROOM_RECRUIT, "When this creature enters, it connives. (Draw a card, then discard a card. If you discarded a nonland card, put a +1/+1 counter on this creature.)");

const VOCAB_L0 = vocabularyEffects("~ connives.", RED_ROOM_RECRUIT.name);
const VOCAB_T_L0 = vocabularyTargets("~ connives.");

export const RED_ROOM_RECRUIT_SCRIPT: CardScript = {
  oracleId: RED_ROOM_RECRUIT.oracleId,
  name: RED_ROOM_RECRUIT.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Red Room Recruit - ~ connives.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
