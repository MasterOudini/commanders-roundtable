// `Barrin's Unmaking` — "Return target permanent to its owner's hand if that
// permanent shares a color with the most common color among all permanents
// or a color tied for most common." The MODE SET is computed at resolution
// over every battlefield permanent's DERIVED colors (ties all count); the
// bounce happens only on a share. A colorless target shares nothing and a
// board with no colored permanent has an empty mode set — both bounce
// nothing, which is the printed rule. D199.

import { BARRIN_S_UNMAKING } from '../../../data/fixtures/engineCards';
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
  BARRIN_S_UNMAKING,
  'Return target permanent to its owner\'s hand if that permanent shares a color with the most common color among all permanents or a color tied for most common.',
);

export const BARRINS_UNMAKING_SCRIPT: CardScript = {
  oracleId: BARRIN_S_UNMAKING.oracleId,
  name: BARRIN_S_UNMAKING.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      const counts = new Map<string, number>();
      for (const id of ctx.state.zones.battlefield) {
        for (const c of ctx.derive(id).colors) counts.set(c, (counts.get(c) ?? 0) + 1);
      }
      const max = Math.max(0, ...counts.values());
      if (max === 0) return [];
      const mode = new Set([...counts.entries()].filter(([, n]) => n === max).map(([c]) => c));
      if (!ctx.derive(target.id).colors.some((c) => mode.has(c))) return [];
      return [
        {
          t: 'CardsMoved',
          moves: [
            {
              card: target.id,
              from: { kind: 'battlefield', player: card.controller },
              to: { kind: 'hand', player: card.owner },
            },
          ],
        },
      ];
    },
  },
};
