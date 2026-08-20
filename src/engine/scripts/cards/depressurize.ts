// `Depressurize` — "Target creature gets -3/-0 until end of turn. Then if
// that creature's power is 0 or less, destroy it." Ambuscade's arithmetic
// from the other side: the post-debuff power is the derived value minus a
// KNOWN 3, so the destroy check is plain subtraction. D207.

import { DEPRESSURIZE } from '../../../data/fixtures/engineCards';
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
  DEPRESSURIZE,
  "Target creature gets -3/-0 until end of turn. Then if that creature's power is 0 or less, destroy it.",
);

export const DEPRESSURIZE_SCRIPT: CardScript = {
  oracleId: DEPRESSURIZE.oracleId,
  name: DEPRESSURIZE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      const d = ctx.derive(target.id);
      const events: EventBody[] = [
        { t: 'PtModifiedUntilEndOfTurn', card: target.id, power: -3, toughness: 0 },
      ];
      const after = (d.power ?? 0) - 3;
      if (after <= 0 && !d.keywords.has('indestructible')) {
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
