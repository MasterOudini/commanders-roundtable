// `Siren's Ruse` — the flicker with a conditional rider: Cloudshift's two
// moves (the return runs the entry funnel), the return to the card's OWNER,
// and the Pirate check read off the DERIVED subtypes BEFORE the exile — a
// flickered card's battlefield derivation is gone once it leaves. D248.

import { SIREN_S_RUSE } from '../../../data/fixtures/engineCards';
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
  SIREN_S_RUSE,
  "Exile target creature you control, then return that card to the battlefield under its owner's control. " +
    'If a Pirate was exiled this way, draw a card.',
);

export const SIRENS_RUSE_SCRIPT: CardScript = {
  oracleId: SIREN_S_RUSE.oracleId,
  name: SIREN_S_RUSE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      const isPirate = ctx.derive(target.id).typeLine.subtypes.includes('Pirate');
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
      if (isPirate) events.push(...drawEvents(ctx.state, obj.controller, 1));
      return events;
    },
  },
};
