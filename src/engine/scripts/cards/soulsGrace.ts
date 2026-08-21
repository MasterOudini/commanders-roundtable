// `Soul's Grace` — "You gain life equal to target creature's power." The
// possessive spec probed confident; the power is derived at resolution. D250.

import { SOUL_S_GRACE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(SOUL_S_GRACE, "You gain life equal to target creature's power.");

export const SOULS_GRACE_SCRIPT: CardScript = {
  oracleId: SOUL_S_GRACE.oracleId,
  name: SOUL_S_GRACE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
      const power = ctx.derive(target.id).power ?? 0;
      if (power <= 0) return [];
      const player = ctx.state.players[obj.controller];
      if (!player || player.hasLost) return [];
      return [{ t: 'LifeChanged', player: obj.controller, delta: power, to: player.life + power }];
    },
  },
};
