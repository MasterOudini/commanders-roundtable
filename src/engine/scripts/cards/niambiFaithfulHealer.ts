// `Niambi, Faithful Healer` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { NIAMBI_FAITHFUL_HEALER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(NIAMBI_FAITHFUL_HEALER, "When Niambi enters, you may search your library and/or graveyard for a card named Teferi, Timebender, reveal it, and put it into your hand. If you search your library this way, shuffle.");

const VOCAB_L0 = vocabularyEffects("Search your library and/or graveyard for a card named Teferi, Timebender, reveal it, and put it into your hand. If you search your library this way, shuffle.", NIAMBI_FAITHFUL_HEALER.name);
const VOCAB_T_L0 = vocabularyTargets("Search your library and/or graveyard for a card named Teferi, Timebender, reveal it, and put it into your hand. If you search your library this way, shuffle.");

export const NIAMBI_FAITHFUL_HEALER_SCRIPT: CardScript = {
  oracleId: NIAMBI_FAITHFUL_HEALER.oracleId,
  name: NIAMBI_FAITHFUL_HEALER.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Niambi, Faithful Healer - Search your library and/or graveyard for a card named Teferi, Timebender, reveal it, and put it into your hand. If you search your library this way, shuffle.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
