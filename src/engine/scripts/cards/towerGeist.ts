// `Tower Geist` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TOWER_GEIST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TOWER_GEIST, "Flying\nWhen this creature enters, look at the top two cards of your library. Put one of them into your hand and the other into your graveyard.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Look at the top two cards of your library. Put one of them into your hand and the other into your graveyard.", TOWER_GEIST.name);
const VOCAB_T_L1 = vocabularyTargets("Look at the top two cards of your library. Put one of them into your hand and the other into your graveyard.");

export const TOWER_GEIST_SCRIPT: CardScript = {
  oracleId: TOWER_GEIST.oracleId,
  name: TOWER_GEIST.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Tower Geist - Look at the top two cards of your library. Put one of them into your hand and the other into your graveyard.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
