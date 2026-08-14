// `Grasping Longneck` — "When this creature dies, you gain 2 life." The
// dies-gain on an ENCHANTMENT creature; line 1 is Reach (Tier 2). M6.4v,
// D178.

import { GRASPING_LONGNECK } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GRASPING_LONGNECK, 'Reach\nWhen this creature dies, you gain 2 life.');
const TEXT = PRINTED.split('\n')[1] as string;

export const GRASPING_LONGNECK_SCRIPT: CardScript = {
  oracleId: GRASPING_LONGNECK.oracleId,
  name: GRASPING_LONGNECK.name,
  triggers: [
    {
      abilityId: 'dies',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard',
        ),
      label: () => 'Grasping Longneck — gain 2 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 2, to: player.life + 2 }];
      },
    },
  ],
};
