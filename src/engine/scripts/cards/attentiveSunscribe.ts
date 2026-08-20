// `Attentive Sunscribe` — "Whenever this creature becomes tapped, scry 1."
// Emmara's `PermanentsTapped` self-filter (D173) raising the D195 ask: every
// tap path — combat never taps here, but mana, costs and the wrench do —
// batches into one event, and `cards.includes(self)` is the whole printed
// condition. D198.

import { ATTENTIVE_SUNSCRIBE } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
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

const TEXT = printed(
  ATTENTIVE_SUNSCRIBE,
  'Whenever this creature becomes tapped, scry 1. (Look at the top card of your library. You may put that card on the bottom.)',
);

export const ATTENTIVE_SUNSCRIBE_SCRIPT: CardScript = {
  oracleId: ATTENTIVE_SUNSCRIBE.oracleId,
  name: ATTENTIVE_SUNSCRIBE.name,
  triggers: [
    {
      abilityId: 'tapped-scry',
      text: TEXT,
      event: 'PermanentsTapped',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'PermanentsTapped' && ev.cards.includes(self),
      label: () => 'Attentive Sunscribe — scry 1',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const n = Math.min(1, library.length);
        if (n === 0) return [];
        const top = library.slice(library.length - n);
        return [
          { t: 'CardsRevealed', cards: top, to: [obj.controller] },
          {
            t: 'AwaitingSet',
            awaiting: {
              kind: 'scryChoice',
              player: obj.controller,
              count: n,
              toGraveyard: false,
              thenDraw: 0,
              label: obj.label,
            },
          },
        ];
      },
    },
  ],
};
