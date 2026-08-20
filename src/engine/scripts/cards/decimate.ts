// `Decimate` — "Destroy target artifact, target creature, target
// enchantment, and target land." FOUR specs in printed order (probed:
// all four parse confident and enforced). CR 608.2b re-checks each on
// resolution — a target that vanished is skipped, the rest still die in
// ONE simultaneous CardsMoved, indestructible per target. D207.

import { DECIMATE } from '../../../data/fixtures/engineCards';
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
  DECIMATE,
  "Destroy target artifact, target creature, target enchantment, and target land. (You can't cast this spell unless you have legal choices for all its targets.)",
);

export const DECIMATE_SCRIPT: CardScript = {
  oracleId: DECIMATE.oracleId,
  name: DECIMATE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const moves = [];
      const seen = new Set<string>();
      for (const target of obj.targets) {
        if (!target || target.kind !== 'card' || seen.has(target.id)) continue;
        seen.add(target.id);
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') continue;
        if (ctx.derive(target.id).keywords.has('indestructible')) continue;
        moves.push({
          card: target.id,
          from: { kind: 'battlefield' as const, player: card.controller },
          to: { kind: 'graveyard' as const, player: card.owner },
        });
      }
      if (moves.length === 0) return [];
      return [{ t: 'CardsMoved', moves }];
    },
  },
};
