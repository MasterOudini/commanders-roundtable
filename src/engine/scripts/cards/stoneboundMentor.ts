// `Stonebound Mentor` — the GRAVEYARD-EXIT watcher meeting the scry ask:
// Desecrated Tomb's filter (cards leaving MY graveyard for anywhere else)
// with the per-event batch as the card's own "one or more". D253.

import { STONEBOUND_MENTOR } from '../../../data/fixtures/engineCards';
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
  STONEBOUND_MENTOR,
  'Whenever one or more cards leave your graveyard, scry 1.',
);

export const STONEBOUND_MENTOR_SCRIPT: CardScript = {
  oracleId: STONEBOUND_MENTOR.oracleId,
  name: STONEBOUND_MENTOR.name,
  triggers: [
    {
      abilityId: 'graveyard-exit',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => {
        if (ev.t !== 'CardsMoved') return false;
        const mine = ctx.query.controllerOf(self);
        return ev.moves.some(
          (m) => m.from.kind === 'graveyard' && m.from.player === mine && m.to.kind !== 'graveyard',
        );
      },
      label: () => 'Stonebound Mentor — scry 1',
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
