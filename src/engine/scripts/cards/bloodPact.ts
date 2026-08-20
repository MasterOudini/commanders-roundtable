// `Blood Pact` — "Target player draws two cards and loses 2 life." The
// TARGET draws (through THE draw rule) and the TARGET pays, printed order.
// D200.

import { BLOOD_PACT } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(BLOOD_PACT, 'Target player draws two cards and loses 2 life.');

export const BLOOD_PACT_SCRIPT: CardScript = {
  oracleId: BLOOD_PACT.oracleId,
  name: BLOOD_PACT.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      const p = ctx.state.players[target.id];
      if (!p || p.hasLost) return [];
      return [
        ...drawEvents(ctx.state, target.id, 2),
        { t: 'LifeChanged', player: target.id, delta: -2, to: p.life - 2 },
      ];
    },
  },
};
