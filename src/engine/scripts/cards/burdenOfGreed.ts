// `Burden of Greed` — "Target player loses 1 life for each tapped artifact
// they control." D202.

import { BURDEN_OF_GREED } from '../../../data/fixtures/engineCards';
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
  BURDEN_OF_GREED,
  'Target player loses 1 life for each tapped artifact they control.',
);

export const BURDEN_OF_GREED_SCRIPT: CardScript = {
  oracleId: BURDEN_OF_GREED.oracleId,
  name: BURDEN_OF_GREED.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      const p = ctx.state.players[target.id];
      if (!p || p.hasLost) return [];
      let n = 0;
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== target.id || !card.tapped) continue;
        if (ctx.derive(id).typeLine.types.includes('Artifact')) n++;
      }
      if (n === 0) return [];
      return [{ t: 'LifeChanged', player: target.id, delta: -n, to: p.life - n }];
    },
  },
};
