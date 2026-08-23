// `Undo` — the COUNTED pair (Dust to Dust's machinery, D209): ONE spec at
// min 2 / max 2, so `obj.targets` carries both and the resolve walks the
// whole list rather than reading index 0.
//
// ⚠️ Each creature goes to ITS OWNER's hand, not the caster's — a stolen
// creature goes home. And each is re-checked on resolution: one having left
// the battlefield does not stop the other (CR 608.2b's per-target rule). D264.

import { UNDO } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';
import type { InstanceId } from '../../types/ids';

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

const TEXT = printed(UNDO, "Return two target creatures to their owners' hands.");

export const UNDO_SCRIPT: CardScript = {
  oracleId: UNDO.oracleId,
  name: UNDO.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const moves: {
        card: InstanceId;
        from: { kind: 'battlefield'; player: string };
        to: { kind: 'hand'; player: string };
      }[] = [];
      for (const target of obj.targets) {
        if (target.kind !== 'card') continue;
        const card = ctx.state.cards[target.id];
        if (card?.zone.kind !== 'battlefield') continue;
        moves.push({
          card: target.id,
          from: { kind: 'battlefield', player: card.controller },
          to: { kind: 'hand', player: card.owner },
        });
      }
      if (moves.length === 0) return [];
      return [{ t: 'CardsMoved', moves }];
    },
  },
};
