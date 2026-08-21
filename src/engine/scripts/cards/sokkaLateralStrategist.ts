// `Sokka, Lateral Strategist` — "Whenever Sokka and at least one other
// creature attack, draw a card." Haazda Marshal's self-among-attackers
// condition at a count of two. D249.

import { SOKKA_LATERAL_STRATEGIST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(
  SOKKA_LATERAL_STRATEGIST,
  'Vigilance\nWhenever Sokka and at least one other creature attack, draw a card.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const SOKKA_LATERAL_STRATEGIST_SCRIPT: CardScript = {
  oracleId: SOKKA_LATERAL_STRATEGIST.oracleId,
  name: SOKKA_LATERAL_STRATEGIST.name,
  triggers: [
    {
      abilityId: 'attacks-with-ally',
      text: TEXT,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'AttackersDeclared' &&
        ev.attackers.some((a) => a.card === self) &&
        ev.attackers.length >= 2,
      label: () => 'Sokka, Lateral Strategist — draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [...drawEvents(ctx.state, obj.controller, 1)];
      },
    },
  ],
};
