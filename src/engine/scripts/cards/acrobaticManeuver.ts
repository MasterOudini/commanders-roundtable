// `Acrobatic Maneuver` — "Exile target creature you control, then return
// that card to the battlefield under its owner's control.\nDraw a card."
// Cloudshift's flicker (D204) with the RETURN read off the OWNER rather than
// the caster, then the draw. Both moves ride one resolve, so the return runs
// the whole entry funnel on a card that briefly left. D272.

import { ACROBATIC_MANEUVER } from '../../../data/fixtures/engineCards';
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
  ACROBATIC_MANEUVER,
  "Exile target creature you control, then return that card to the battlefield under its owner's control.\nDraw a card.",
);

export const ACROBATIC_MANEUVER_SCRIPT: CardScript = {
  oracleId: ACROBATIC_MANEUVER.oracleId,
  name: ACROBATIC_MANEUVER.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      return [
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
              // "under its owner's control" — the owner, not the caster.
              to: { kind: 'battlefield', player: card.owner },
            },
          ],
        },
        ...drawEvents(ctx.state, obj.controller, 1),
      ];
    },
  },
};
