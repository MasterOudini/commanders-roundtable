// `Eye Gouge` — "Target creature gets -1/-1 until end of turn. If it's a
// Cyclops, destroy it." The subtype is DERIVED at resolution; a Cyclops
// takes the debuff and the destroy in one resolve. D212.

import { EYE_GOUGE } from '../../../data/fixtures/engineCards';
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
  EYE_GOUGE,
  "Target creature gets -1/-1 until end of turn. If it's a Cyclops, destroy it.",
);

export const EYE_GOUGE_SCRIPT: CardScript = {
  oracleId: EYE_GOUGE.oracleId,
  name: EYE_GOUGE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      const d = ctx.derive(target.id);
      const events: EventBody[] = [
        { t: 'PtModifiedUntilEndOfTurn', card: target.id, power: -1, toughness: -1 },
      ];
      if (d.typeLine.subtypes.includes('Cyclops') && !d.keywords.has('indestructible')) {
        events.push({
          t: 'CardsMoved',
          moves: [
            {
              card: target.id,
              from: { kind: 'battlefield', player: card.controller },
              to: { kind: 'graveyard', player: card.owner },
            },
          ],
        });
      }
      return events;
    },
  },
};
