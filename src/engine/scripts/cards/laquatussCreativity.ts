// `Laquatus's Creativity` — the target draws their hand's worth, then
// the DISCARD ask goes to them: the first SpellDef to raise the
// chooseFromZone discard prompt (the ask is LAST, per D195's rule).
// D221.

import { LAQUATUS_S_CREATIVITY } from '../../../data/fixtures/engineCards';
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
  LAQUATUS_S_CREATIVITY,
  'Target player draws cards equal to the number of cards in their hand, then discards that many cards.',
);

export const LAQUATUSS_CREATIVITY_SCRIPT: CardScript = {
  oracleId: LAQUATUS_S_CREATIVITY.oracleId,
  name: LAQUATUS_S_CREATIVITY.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      const p = ctx.state.players[target.id];
      if (!p || p.hasLost) return [];
      const n = (ctx.state.zones.hand[target.id] ?? []).length;
      if (n === 0) return [];
      return [
        ...drawEvents(ctx.state, target.id, n),
        {
          t: 'AwaitingSet',
          awaiting: {
            kind: 'chooseFromZone',
            player: target.id,
            zone: 'hand',
            rest: null,
            count: n,
            label: obj.label,
          },
        },
      ];
    },
  },
};
