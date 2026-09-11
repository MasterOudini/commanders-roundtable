// `Carrier Pigeons` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CARRIER_PIGEONS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CARRIER_PIGEONS, "Flying\nWhen this creature enters, draw a card at the beginning of the next turn's upkeep.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Draw a card at the beginning of the next turn's upkeep.", CARRIER_PIGEONS.name);
const VOCAB_T_L1 = vocabularyTargets("Draw a card at the beginning of the next turn's upkeep.");

export const CARRIER_PIGEONS_SCRIPT: CardScript = {
  oracleId: CARRIER_PIGEONS.oracleId,
  name: CARRIER_PIGEONS.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Carrier Pigeons - Draw a card at the beginning of the next turn's upkeep.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
