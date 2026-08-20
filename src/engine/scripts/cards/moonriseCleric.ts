// `Moonrise Cleric` — "Whenever this creature attacks, you gain 1 life."
// The self-attack gain. D226.

import { MOONRISE_CLERIC } from '../../../data/fixtures/engineCards';
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
  MOONRISE_CLERIC,
  'Flying\nWhenever this creature attacks, you gain 1 life.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const MOONRISE_CLERIC_SCRIPT: CardScript = {
  oracleId: MOONRISE_CLERIC.oracleId,
  name: MOONRISE_CLERIC.name,
  triggers: [
    {
      abilityId: 'attacks-gain',
      text: TEXT,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => 'Moonrise Cleric — gain 1 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 1, to: player.life + 1 }];
      },
    },
  ],
};
