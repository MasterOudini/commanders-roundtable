// `Strip Bare` — destroy every Aura and Equipment attached to ONE creature:
// the attachment walk (Disarm's shape, D208) pointed at a single host,
// each attachment checking its own indestructible. D254.

import { STRIP_BARE } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardMove, EventBody } from '../../types/events';
import type { CardScript } from '../api';

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

const TEXT = printed(STRIP_BARE, 'Destroy all Auras and Equipment attached to target creature.');

export const STRIP_BARE_SCRIPT: CardScript = {
  oracleId: STRIP_BARE.oracleId,
  name: STRIP_BARE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
      const moves: CardMove[] = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.attachedTo !== target.id) continue;
        const subtypes = ctx.derive(id).typeLine.subtypes;
        if (!subtypes.includes('Aura') && !subtypes.includes('Equipment')) continue;
        if (ctx.derive(id).keywords.has('indestructible')) continue;
        moves.push({
          card: id,
          from: { kind: 'battlefield', player: card.controller },
          to: { kind: 'graveyard', player: card.owner },
        });
      }
      if (moves.length === 0) return [];
      return [{ t: 'CardsMoved', moves }];
    },
  },
};
