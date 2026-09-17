// `Yanling's Harbinger` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { YANLING_S_HARBINGER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(YANLING_S_HARBINGER, "Flying\nWhen this creature enters, you may search your library and/or graveyard for a card named Mu Yanling, Celestial Wind, reveal it, and put it into your hand. If you search your library this way, shuffle.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Search your library and/or graveyard for a card named Mu Yanling, Celestial Wind, reveal it, and put it into your hand. If you search your library this way, shuffle.", YANLING_S_HARBINGER.name);
const VOCAB_T_L1 = vocabularyTargets("Search your library and/or graveyard for a card named Mu Yanling, Celestial Wind, reveal it, and put it into your hand. If you search your library this way, shuffle.");

export const YANLINGS_HARBINGER_SCRIPT: CardScript = {
  oracleId: YANLING_S_HARBINGER.oracleId,
  name: YANLING_S_HARBINGER.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Yanling's Harbinger - Search your library and/or graveyard for a card named Mu Yanling, Celestial Wind, reveal it, and put it into your hand. If you search your library this way, shuffle.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
