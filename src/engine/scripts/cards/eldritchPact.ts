// `Eldritch Pact` — "Target player draws X cards and loses X life, where X
// is the number of cards in their graveyard." Damnable Pact with X read
// off the TARGET's graveyard at resolution. D210.

import { ELDRITCH_PACT } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(
  ELDRITCH_PACT,
  'Target player draws X cards and loses X life, where X is the number of cards in their graveyard.',
);

export const ELDRITCH_PACT_SCRIPT: CardScript = {
  oracleId: ELDRITCH_PACT.oracleId,
  name: ELDRITCH_PACT.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      const p = ctx.state.players[target.id];
      if (!p || p.hasLost) return [];
      const x = (ctx.state.zones.graveyard[target.id] ?? []).length;
      if (x <= 0) return [];
      return [
        ...drawEvents(ctx.state, target.id, x),
        { t: 'LifeChanged', player: target.id, delta: -x, to: p.life - x },
      ];
    },
  },
};
