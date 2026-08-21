// `Sultai Soothsayer` — the ETB library TAKE with `rest: 'graveyard'`:
// look at four, ONE to hand, three binned. Stargaze's ask raised from a
// trigger instead of a spell. D255.

import { SULTAI_SOOTHSAYER } from '../../../data/fixtures/engineCards';
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
  SULTAI_SOOTHSAYER,
  'When this creature enters, look at the top four cards of your library. ' +
    'Put one of them into your hand and the rest into your graveyard.',
);

export const SULTAI_SOOTHSAYER_SCRIPT: CardScript = {
  oracleId: SULTAI_SOOTHSAYER.oracleId,
  name: SULTAI_SOOTHSAYER.name,
  triggers: [
    {
      abilityId: 'etb-dig',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Sultai Soothsayer — one to your hand, the rest to the graveyard',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const n = Math.min(4, library.length);
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
