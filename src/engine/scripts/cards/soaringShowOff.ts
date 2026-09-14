// `Soaring Show-Off` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SOARING_SHOW_OFF } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SOARING_SHOW_OFF, "Flying\nWhen this creature enters, each player draws a card.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Each player draws a card.", SOARING_SHOW_OFF.name);
const VOCAB_T_L1 = vocabularyTargets("Each player draws a card.");

export const SOARING_SHOW_OFF_SCRIPT: CardScript = {
  oracleId: SOARING_SHOW_OFF.oracleId,
  name: SOARING_SHOW_OFF.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Soaring Show-Off - Each player draws a card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
