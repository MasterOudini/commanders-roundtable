// `Peer into the Abyss` — "Target player draws cards equal to half the
// number of cards in their library and loses half their life. Round up
// each time." Two ceilings in one resolve. D232.

import { PEER_INTO_THE_ABYSS } from '../../../data/fixtures/engineCards';
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
  PEER_INTO_THE_ABYSS,
  'Target player draws cards equal to half the number of cards in their library and loses half their life. Round up each time.',
);

export const PEER_INTO_THE_ABYSS_SCRIPT: CardScript = {
  oracleId: PEER_INTO_THE_ABYSS.oracleId,
  name: PEER_INTO_THE_ABYSS.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      const p = ctx.state.players[target.id];
      if (!p || p.hasLost) return [];
      const draws = Math.ceil((ctx.state.zones.library[target.id] ?? []).length / 2);
      const loss = Math.ceil(p.life / 2);
      const events: EventBody[] = [];
      if (draws > 0) events.push(...drawEvents(ctx.state, target.id, draws));
      if (loss > 0) {
        events.push({ t: 'LifeChanged', player: target.id, delta: -loss, to: p.life - loss });
      }
      return events;
    },
  },
};
