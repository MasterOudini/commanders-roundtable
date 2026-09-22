// `Rogue Refiner` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ROGUE_REFINER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ROGUE_REFINER, "When this creature enters, draw a card and you get {E}{E} (two energy counters).");

const VOCAB_L0 = vocabularyEffects("Draw a card and you get {E}{E}.", ROGUE_REFINER.name);
const VOCAB_T_L0 = vocabularyTargets("Draw a card and you get {E}{E}.");

export const ROGUE_REFINER_SCRIPT: CardScript = {
  oracleId: ROGUE_REFINER.oracleId,
  name: ROGUE_REFINER.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Rogue Refiner - Draw a card and you get {E}{E}.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
