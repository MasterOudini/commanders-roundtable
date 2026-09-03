// `Razor Rings` — 4 damage to the attacking or blocking creature, and life
// equal to the EXCESS: what 4 exceeds the creature's remaining toughness by
// (derived toughness less damage already marked). D291's role.

import { RAZOR_RINGS } from '../../../data/fixtures/engineCards';
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
  RAZOR_RINGS,
  'Razor Rings deals 4 damage to target attacking or blocking creature. You gain life equal to the excess damage dealt this way.',
);

export const RAZOR_RINGS_SCRIPT: CardScript = {
  oracleId: RAZOR_RINGS.oracleId,
  name: RAZOR_RINGS.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      const toughness = ctx.derive(target.id).toughness ?? 0;
      const lethal = Math.max(0, toughness - card.damage);
      const excess = Math.max(0, 4 - lethal);
      const events: EventBody[] = [
        {
          t: 'DamageDealt',
          damages: [{ source: self, target: { kind: 'card', id: target.id }, amount: 4, deathtouch: false, lifelinkTo: null, isCommanderDamage: false, viaTrample: 0, toxic: 0, applyAs: 'normal' }],
        },
      ];
      const me = ctx.state.players[obj.controller];
      if (me && excess > 0) events.push({ t: 'LifeChanged', player: obj.controller, delta: excess, to: me.life + excess });
      return events;
    },
  },
};
