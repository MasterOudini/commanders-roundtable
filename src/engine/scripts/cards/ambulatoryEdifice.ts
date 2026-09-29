// `Ambulatory Edifice` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { AMBULATORY_EDIFICE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(AMBULATORY_EDIFICE, "When this creature enters, you may pay 2 life. When you do, target creature gets -1/-1 until end of turn.");

const VOCAB_L0 = vocabularyEffects("You may pay 2 life. When you do, target creature gets -1/-1 until end of turn.", AMBULATORY_EDIFICE.name);
const VOCAB_T_L0 = vocabularyTargets("You may pay 2 life. When you do, target creature gets -1/-1 until end of turn.");

export const AMBULATORY_EDIFICE_SCRIPT: CardScript = {
  oracleId: AMBULATORY_EDIFICE.oracleId,
  name: AMBULATORY_EDIFICE.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Ambulatory Edifice - You may pay 2 life. When you do, target creature gets -1/-1 until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
