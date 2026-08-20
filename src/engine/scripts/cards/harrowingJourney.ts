// `Harrowing Journey` — the TARGET player draws three and loses 3: the
// draw rule runs for whoever the arrow names. D217.

import { HARROWING_JOURNEY } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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

const TEXT = printed(HARROWING_JOURNEY, 'Target player draws three cards and loses 3 life.');

export const HARROWING_JOURNEY_SCRIPT: CardScript = {
  oracleId: HARROWING_JOURNEY.oracleId,
  name: HARROWING_JOURNEY.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      const p = ctx.state.players[target.id];
      if (!p || p.hasLost) return [];
      return [
        ...drawEvents(ctx.state, target.id, 3),
        { t: 'LifeChanged', player: target.id, delta: -3, to: p.life - 3 },
      ];
    },
  },
};
