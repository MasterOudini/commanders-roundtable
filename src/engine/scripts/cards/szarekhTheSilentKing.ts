// `Szarekh, the Silent King` - a attacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SZAREKH_THE_SILENT_KING } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SZAREKH_THE_SILENT_KING, "Flying\nMy Will Be Done — Whenever Szarekh attacks, mill three cards. You may put an artifact creature card or Vehicle card from among the cards milled this way into your hand.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Mill three cards. You may put an artifact creature card or Vehicle card from among the cards milled this way into your hand.", SZAREKH_THE_SILENT_KING.name);
const VOCAB_T_L1 = vocabularyTargets("Mill three cards. You may put an artifact creature card or Vehicle card from among the cards milled this way into your hand.");

export const SZAREKH_THE_SILENT_KING_SCRIPT: CardScript = {
  oracleId: SZAREKH_THE_SILENT_KING.oracleId,
  name: SZAREKH_THE_SILENT_KING.name,
  triggers: [
    {
      abilityId: 'attacks-1',
      text: LINES[1] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Szarekh, the Silent King - Mill three cards. You may put an artifact creature card or Vehicle card from among the cards milled this way into your hand.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
