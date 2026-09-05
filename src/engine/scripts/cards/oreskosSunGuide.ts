// `Oreskos Sun Guide` - a becomesUntapped trigger gainLife
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ORESKOS_SUN_GUIDE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ORESKOS_SUN_GUIDE, "Inspired — Whenever this creature becomes untapped, you gain 2 life.");

export const ORESKOS_SUN_GUIDE_SCRIPT: CardScript = {
  oracleId: ORESKOS_SUN_GUIDE.oracleId,
  name: ORESKOS_SUN_GUIDE.name,
  triggers: [
    {
      abilityId: 'becomesUntapped-0',
      text: PRINTED,
      event: 'PermanentsUntapped',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'PermanentsUntapped' && ev.cards.includes(self),
      label: () => "Oreskos Sun Guide - gain life",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 2, to: me.life + 2 }];
      },
    },
  ],
};
