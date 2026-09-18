// `Neurok Familiar` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { NEUROK_FAMILIAR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(NEUROK_FAMILIAR, "Flying\nWhen this creature enters, reveal the top card of your library. If it's an artifact card, put it into your hand. Otherwise, put it into your graveyard.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Reveal the top card of your library. If it's an artifact card, put it into your hand. Otherwise, put it into your graveyard.", NEUROK_FAMILIAR.name);
const VOCAB_T_L1 = vocabularyTargets("Reveal the top card of your library. If it's an artifact card, put it into your hand. Otherwise, put it into your graveyard.");

export const NEUROK_FAMILIAR_SCRIPT: CardScript = {
  oracleId: NEUROK_FAMILIAR.oracleId,
  name: NEUROK_FAMILIAR.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Neurok Familiar - Reveal the top card of your library. If it's an artifact card, put it into your hand. Otherwise, put it into your graveyard.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
