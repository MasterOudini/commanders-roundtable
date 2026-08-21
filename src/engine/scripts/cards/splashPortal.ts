// `Splash Portal` — the flicker with a FOUR-subtype rider read PRE-exile:
// Bird, Frog, Otter, or Rat pays a draw. D251.

import { SPLASH_PORTAL } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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
  SPLASH_PORTAL,
  "Exile target creature you control, then return it to the battlefield under its owner's control. " +
    'If that creature is a Bird, Frog, Otter, or Rat, draw a card.',
);

export const SPLASH_PORTAL_SCRIPT: CardScript = {
  oracleId: SPLASH_PORTAL.oracleId,
  name: SPLASH_PORTAL.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      const subtypes = ctx.derive(target.id).typeLine.subtypes;
      const pays = ['Bird', 'Frog', 'Otter', 'Rat'].some((s) => subtypes.includes(s));
      const events: EventBody[] = [
        {
          t: 'CardsMoved',
          moves: [
            {
              card: target.id,
              from: { kind: 'battlefield', player: card.controller },
              to: { kind: 'exile', player: card.owner },
            },
          ],
        },
        {
          t: 'CardsMoved',
          moves: [
            {
              card: target.id,
              from: { kind: 'exile', player: card.owner },
              to: { kind: 'battlefield', player: card.owner },
            },
          ],
        },
      ];
      if (pays) events.push(...drawEvents(ctx.state, obj.controller, 1));
      return events;
    },
  },
};
