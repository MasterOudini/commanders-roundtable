// `General Traag, Heart of Stone` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GENERAL_TRAAG_HEART_OF_STONE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GENERAL_TRAAG_HEART_OF_STONE, "Trample\nWhen General Traag enters, you may sacrifice another artifact. When you do, General Traag deals 4 damage to target creature.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("You may sacrifice another artifact. When you do, ~ deals 4 damage to target creature.", GENERAL_TRAAG_HEART_OF_STONE.name);
const VOCAB_T_L1 = vocabularyTargets("You may sacrifice another artifact. When you do, ~ deals 4 damage to target creature.");

export const GENERAL_TRAAG_HEART_OF_STONE_SCRIPT: CardScript = {
  oracleId: GENERAL_TRAAG_HEART_OF_STONE.oracleId,
  name: GENERAL_TRAAG_HEART_OF_STONE.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "General Traag, Heart of Stone - You may sacrifice another artifact. When you do, ~ deals 4 damage to target creature.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
