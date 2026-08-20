// `Damnable Pact` — "Target player draws X cards and loses X life."
// Braingeyser's target-draws-X plus the mirror LifeChanged, printed order:
// draws first, the loss after (the SBA answers a lethal loss). D206.

import { DAMNABLE_PACT } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(DAMNABLE_PACT, 'Target player draws X cards and loses X life.');

export const DAMNABLE_PACT_SCRIPT: CardScript = {
  oracleId: DAMNABLE_PACT.oracleId,
  name: DAMNABLE_PACT.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const x = obj.xValue ?? 0;
      if (x <= 0) return [];
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      const p = ctx.state.players[target.id];
      if (!p || p.hasLost) return [];
      return [
        ...drawEvents(ctx.state, target.id, x),
        { t: 'LifeChanged', player: target.id, delta: -x, to: p.life - x },
      ];
    },
  },
};
