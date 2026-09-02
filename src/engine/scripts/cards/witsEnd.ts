// `Wit's End` — "Target player discards their hand." The WHOLE hand, so no
// ask is needed and none is raised: the contrast with batch-mate
// `Wistful Thinking`, which discards a COUNT and therefore must raise
// `chooseFromZone`. ⚠️ The apostrophe const is `WIT_S_END`. D270.

import { WIT_S_END } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(WIT_S_END, 'Target player discards their hand.');

export const WITS_END_SCRIPT: CardScript = {
  oracleId: WIT_S_END.oracleId,
  name: WIT_S_END.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      const victim = ctx.state.players[target.id];
      if (!victim || victim.hasLost) return [];
      const hand = ctx.state.zones.hand[target.id] ?? [];
      const moves = [];
      for (const id of hand) {
        const card = ctx.state.cards[id];
        if (!card) continue;
        moves.push({
          card: id,
          from: { kind: 'hand' as const, player: target.id },
          to: { kind: 'graveyard' as const, player: card.owner },
        });
      }
      if (moves.length === 0) return [];
      return [{ t: 'CardsMoved', moves }];
    },
  },
};
