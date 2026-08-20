// `Leave No Trace` — Radiance on a destroy: the target enchantment and
// every other enchantment sharing a color with it. D222.

import { LEAVE_NO_TRACE } from '../../../data/fixtures/engineCards';
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
  LEAVE_NO_TRACE,
  'Radiance — Destroy target enchantment and each other enchantment that shares a color with it.',
);

export const LEAVE_NO_TRACE_SCRIPT: CardScript = {
  oracleId: LEAVE_NO_TRACE.oracleId,
  name: LEAVE_NO_TRACE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const victim = ctx.state.cards[target.id];
      if (!victim || victim.zone.kind !== 'battlefield') return [];
      const colors = ctx.derive(target.id).colors;
      const moves = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Enchantment')) continue;
        const isTarget = id === target.id;
        if (!isTarget && !d.colors.some((c) => colors.includes(c))) continue;
        if (d.keywords.has('indestructible')) continue;
        moves.push({
          card: id,
          from: { kind: 'battlefield' as const, player: card.controller },
          to: { kind: 'graveyard' as const, player: card.owner },
        });
      }
      if (moves.length === 0) return [];
      return [{ t: 'CardsMoved', moves }];
    },
  },
};
