// `Stomp and Howl` — the probed two-spec destroy: an artifact AND an
// enchantment, each checking its own indestructible, one batch. D253.

import { STOMP_AND_HOWL } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(STOMP_AND_HOWL, 'Destroy target artifact and target enchantment.');

export const STOMP_AND_HOWL_SCRIPT: CardScript = {
  oracleId: STOMP_AND_HOWL.oracleId,
  name: STOMP_AND_HOWL.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const moves: CardMove[] = [];
      for (const target of obj.targets) {
        if (!target || target.kind !== 'card') continue;
        const card = ctx.state.cards[target.id];
        if (card?.zone.kind !== 'battlefield') continue;
        if (ctx.derive(target.id).keywords.has('indestructible')) continue;
        moves.push({
          card: target.id,
          from: { kind: 'battlefield', player: card.controller },
          to: { kind: 'graveyard', player: card.owner },
        });
      }
      if (moves.length === 0) return [];
      return [{ t: 'CardsMoved', moves }];
    },
  },
};
