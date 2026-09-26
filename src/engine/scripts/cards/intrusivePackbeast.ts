// `Intrusive Packbeast` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { INTRUSIVE_PACKBEAST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(INTRUSIVE_PACKBEAST, "Vigilance\nWhen this creature enters, tap up to two target creatures your opponents control.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Tap up to two target creatures your opponents control.", INTRUSIVE_PACKBEAST.name);
const VOCAB_T_L1 = vocabularyTargets("Tap up to two target creatures your opponents control.");

export const INTRUSIVE_PACKBEAST_SCRIPT: CardScript = {
  oracleId: INTRUSIVE_PACKBEAST.oracleId,
  name: INTRUSIVE_PACKBEAST.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Intrusive Packbeast - Tap up to two target creatures your opponents control.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
