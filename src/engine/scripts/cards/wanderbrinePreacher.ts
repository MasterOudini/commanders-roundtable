// `Wanderbrine Preacher` — Attentive Sunscribe's becomes-tapped watcher with
// a life gain instead of a scry. It fires on ANY tap, not only an attack or a
// mana tap, which is exactly what `PermanentsTapped` reports. D267.

import { WANDERBRINE_PREACHER } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(WANDERBRINE_PREACHER, 'Whenever this creature becomes tapped, you gain 2 life.');

export const WANDERBRINE_PREACHER_SCRIPT: CardScript = {
  oracleId: WANDERBRINE_PREACHER.oracleId,
  name: WANDERBRINE_PREACHER.name,
  triggers: [
    {
      abilityId: 'tapped-gain',
      text: TEXT,
      event: 'PermanentsTapped',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'PermanentsTapped' && ev.cards.includes(self),
      label: () => 'Wanderbrine Preacher — you gain 2 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me || me.hasLost) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 2, to: me.life + 2 }];
      },
    },
  ],
};
