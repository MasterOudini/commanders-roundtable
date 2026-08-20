// `Monumental Corruption` — "Target player draws X cards and loses X life,
// where X is the number of artifacts you control." Minions' Murmurs pointed
// at a TARGET, censusing the CASTER's artifacts. D226.

import { MONUMENTAL_CORRUPTION } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';
import { drawEvents } from '../../effects';

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
  MONUMENTAL_CORRUPTION,
  'Target player draws X cards and loses X life, where X is the number of artifacts you control.',
);

export const MONUMENTAL_CORRUPTION_SCRIPT: CardScript = {
  oracleId: MONUMENTAL_CORRUPTION.oracleId,
  name: MONUMENTAL_CORRUPTION.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      const p = ctx.state.players[target.id];
      if (!p || p.hasLost) return [];
      let x = 0;
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== obj.controller) continue;
        if (!ctx.derive(id).typeLine.types.includes('Artifact')) continue;
        x++;
      }
      if (x === 0) return [];
      return [
        ...drawEvents(ctx.state, target.id, x),
        { t: 'LifeChanged', player: target.id, delta: -x, to: p.life - x },
      ];
    },
  },
};
