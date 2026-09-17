// `Ring of Three Wishes` - a static entersWithCounters, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RING_OF_THREE_WISHES } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RING_OF_THREE_WISHES, "This artifact enters with three wish counters on it.\n{5}, {T}, Remove a wish counter from this artifact: Search your library for a card, put that card into your hand, then shuffle.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Search your library for a card, put that card into your hand, then shuffle.", RING_OF_THREE_WISHES.name);
const VOCAB_T_A0 = vocabularyTargets("Search your library for a card, put that card into your hand, then shuffle.");

export const RING_OF_THREE_WISHES_SCRIPT: CardScript = {
  oracleId: RING_OF_THREE_WISHES.oracleId,
  name: RING_OF_THREE_WISHES.name,
  activated: [
    {
      ref: `${RING_OF_THREE_WISHES.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  replacements: [
    {
      abilityId: 'enters-with-0',
      text: LINES[0] as string,
      activeZones: ['battlefield'],
      // CR 614.12 - offered to the entering card itself (D371).
      applies: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      replace: (_ctx, self, ev): readonly EventBody[] => [ev, { t: 'CountersChanged', changes: [{ card: self, kind: "wish", delta: 3 }] }],
    },
  ],
};
