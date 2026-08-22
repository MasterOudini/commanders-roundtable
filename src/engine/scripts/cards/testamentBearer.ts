// `Testament Bearer` — Sultai Soothsayer's library take (D255) raised from a
// DIES trigger rather than an entry: look at three, one to hand, the rest to
// the graveyard. The ask is the whole resolve, so ask-LAST holds by
// construction (D195). D258.

import { TESTAMENT_BEARER } from '../../../data/fixtures/engineCards';
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
  TESTAMENT_BEARER,
  'When this creature dies, look at the top three cards of your library. Put one of them into your hand and the rest into your graveyard.',
);

export const TESTAMENT_BEARER_SCRIPT: CardScript = {
  oracleId: TESTAMENT_BEARER.oracleId,
  name: TESTAMENT_BEARER.name,
  triggers: [
    {
      abilityId: 'dies',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard',
        ),
      label: () => 'Testament Bearer — look at the top three',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const n = Math.min(3, library.length);
        if (n === 0) return [];
        const top = library.slice(library.length - n);
        return [
          { t: 'CardsRevealed', cards: top, to: [obj.controller] },
          {
            t: 'AwaitingSet',
            awaiting: {
              kind: 'chooseFromZone',
              player: obj.controller,
              zone: 'library',
              rest: 'graveyard',
              count: Math.min(1, n),
              label: obj.label,
            },
          },
        ];
      },
    },
  ],
};
