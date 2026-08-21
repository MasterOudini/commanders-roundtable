// `Shopkeeper's Bane` — "Trample / Whenever this creature attacks, you
// gain 2 life." The self-attack gain behind a keyword line. D246.

import { SHOPKEEPER_S_BANE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(
  SHOPKEEPER_S_BANE,
  'Trample\nWhenever this creature attacks, you gain 2 life.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const SHOPKEEPERS_BANE_SCRIPT: CardScript = {
  oracleId: SHOPKEEPER_S_BANE.oracleId,
  name: SHOPKEEPER_S_BANE.name,
  triggers: [
    {
      abilityId: 'attacks-gain',
      text: TEXT,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Shopkeeper's Bane — you gain 2 life",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 2, to: player.life + 2 }];
      },
    },
  ],
};
