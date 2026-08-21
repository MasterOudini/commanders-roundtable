// `Shadows' Verdict` — "Exile all creatures and planeswalkers with mana
// value 3 or less from the battlefield and all creature and planeswalker
// cards with mana value 3 or less from all graveyards." The two-zone
// exile sweep behind one MV bar. D246.

import { SHADOWS_VERDICT } from '../../../data/fixtures/engineCards';
import { faceOf } from '../../oracle';
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
  SHADOWS_VERDICT,
  'Exile all creatures and planeswalkers with mana value 3 or less from the battlefield and all creature and planeswalker cards with mana value 3 or less from all graveyards.',
);

export const SHADOWS_VERDICT_SCRIPT: CardScript = {
  oracleId: SHADOWS_VERDICT.oracleId,
  name: SHADOWS_VERDICT.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, _obj): readonly EventBody[] => {
      const moves = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card) continue;
        const d = ctx.derive(id);
        const types = d.typeLine.types;
        if (!types.includes('Creature') && !types.includes('Planeswalker')) continue;
        const mv = ctx.oracle.byPrinting(card.printingId)?.manaValue ?? 0;
        if (mv > 3) continue;
        moves.push({
          card: id,
          from: { kind: 'battlefield' as const, player: card.controller },
          to: { kind: 'exile' as const, player: card.owner },
        });
      }
      for (const seat of ctx.state.seating) {
        for (const id of ctx.state.zones.graveyard[seat] ?? []) {
          const card = ctx.state.cards[id];
          const oc = card ? ctx.oracle.byPrinting(card.printingId) : undefined;
          if (!card || !oc) continue;
          const types = faceOf(oc, card.faceIndex ?? 0).typeLine.types;
          if (!types.includes('Creature') && !types.includes('Planeswalker')) continue;
          if ((oc.manaValue ?? 0) > 3) continue;
          moves.push({
            card: id,
            from: { kind: 'graveyard' as const, player: seat },
            to: { kind: 'exile' as const, player: card.owner },
          });
        }
      }
      if (moves.length === 0) return [];
      return [{ t: 'CardsMoved', moves }];
    },
  },
};
