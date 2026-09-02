// `Healing Hands` — "Target player gains 4 life.\nDraw a card." The life
// goes to the TARGET (any player, me included), the card to me. D276.

import { HEALING_HANDS } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(HEALING_HANDS, 'Target player gains 4 life.\nDraw a card.');

export const HEALING_HANDS_SCRIPT: CardScript = {
  oracleId: HEALING_HANDS.oracleId,
  name: HEALING_HANDS.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      const them = ctx.state.players[target.id];
      if (!them || them.hasLost) return [];
      return [
        { t: 'LifeChanged', player: target.id, delta: 4, to: them.life + 4 },
        ...drawEvents(ctx.state, obj.controller, 1),
      ];
    },
  },
};
