// `Skyshroud Sentinel` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SKYSHROUD_SENTINEL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SKYSHROUD_SENTINEL, "When this creature enters, you may search your library for up to three cards named Skyshroud Sentinel, reveal them, put them into your hand, then shuffle.");

const VOCAB_L0 = vocabularyEffects("Search your library for up to three cards named ~, reveal them, put them into your hand, then shuffle.", SKYSHROUD_SENTINEL.name);
const VOCAB_T_L0 = vocabularyTargets("Search your library for up to three cards named ~, reveal them, put them into your hand, then shuffle.");

export const SKYSHROUD_SENTINEL_SCRIPT: CardScript = {
  oracleId: SKYSHROUD_SENTINEL.oracleId,
  name: SKYSHROUD_SENTINEL.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Skyshroud Sentinel - Search your library for up to three cards named ~, reveal them, put them into your hand, then shuffle.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
