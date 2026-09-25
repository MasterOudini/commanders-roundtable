// `Codecracker Hound` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CODECRACKER_HOUND } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CODECRACKER_HOUND, "When this creature enters, look at the top two cards of your library. Put one into your hand and the other into your graveyard.\nWarp {2}{U} (You may cast this card from your hand for its warp cost. Exile this creature at the beginning of the next end step, then you may cast it from exile on a later turn.)");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Look at the top two cards of your library. Put one into your hand and the other into your graveyard.", CODECRACKER_HOUND.name);
const VOCAB_T_L0 = vocabularyTargets("Look at the top two cards of your library. Put one into your hand and the other into your graveyard.");

export const CODECRACKER_HOUND_SCRIPT: CardScript = {
  oracleId: CODECRACKER_HOUND.oracleId,
  name: CODECRACKER_HOUND.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Codecracker Hound - Look at the top two cards of your library. Put one into your hand and the other into your graveyard.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
