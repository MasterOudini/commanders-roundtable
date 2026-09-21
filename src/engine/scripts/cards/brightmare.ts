// `Brightmare` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BRIGHTMARE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BRIGHTMARE, "When this creature enters, tap up to one target creature. You gain life equal to that creature's power.");

const VOCAB_L0 = vocabularyEffects("Tap up to one target creature. You gain life equal to that creature's power.", BRIGHTMARE.name);
const VOCAB_T_L0 = vocabularyTargets("Tap up to one target creature. You gain life equal to that creature's power.");

export const BRIGHTMARE_SCRIPT: CardScript = {
  oracleId: BRIGHTMARE.oracleId,
  name: BRIGHTMARE.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Brightmare - Tap up to one target creature. You gain life equal to that creature's power.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
