// `Hurkyl's Recall` — every artifact the target player OWNS goes to
// their hand: the scan is by OWNER, so a lent-out Ring comes home. D218.

import { HURKYL_S_RECALL } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(HURKYL_S_RECALL, 'Return all artifacts target player owns to their hand.');

export const HURKYLS_RECALL_SCRIPT: CardScript = {
  oracleId: HURKYL_S_RECALL.oracleId,
  name: HURKYL_S_RECALL.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      if (ctx.state.players[target.id]?.hasLost) return [];
      const moves = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.owner !== target.id) continue;
        if (!ctx.derive(id).typeLine.types.includes('Artifact')) continue;
        moves.push({
          card: id,
          from: { kind: 'battlefield' as const, player: card.controller },
          to: { kind: 'hand' as const, player: card.owner },
        });
      }
      if (moves.length === 0) return [];
      return [{ t: 'CardsMoved', moves }];
    },
  },
};
