// `Lantern of the Lost` - a etb trigger vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LANTERN_OF_THE_LOST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LANTERN_OF_THE_LOST, "When this artifact enters, exile target card from a graveyard.\n{1}, {T}, Exile this artifact: Exile all cards from all graveyards, then draw a card.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Exile target card from a graveyard.", LANTERN_OF_THE_LOST.name);
const VOCAB_T_L0 = vocabularyTargets("Exile target card from a graveyard.");
const VOCAB_A0 = vocabularyEffects("Exile all cards from all graveyards, then draw a card.", LANTERN_OF_THE_LOST.name);
const VOCAB_T_A0 = vocabularyTargets("Exile all cards from all graveyards, then draw a card.");

export const LANTERN_OF_THE_LOST_SCRIPT: CardScript = {
  oracleId: LANTERN_OF_THE_LOST.oracleId,
  name: LANTERN_OF_THE_LOST.name,
  activated: [
    {
      ref: `${LANTERN_OF_THE_LOST.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Lantern of the Lost - Exile target card from a graveyard.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
