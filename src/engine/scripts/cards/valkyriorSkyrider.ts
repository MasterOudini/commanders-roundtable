// `Valkyrior Skyrider` — the plain ETB life gain at 4. One printed shape across
// three oracle ids this arc (Tireless Missionaries D260, Turntimber Ascetic
// D263, this), so it is generated from one base rather than copied. D265.

import { VALKYRIOR_SKYRIDER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VALKYRIOR_SKYRIDER, 'Flying (This creature can\'t be blocked except by creatures with flying or reach.)\nWhen this creature enters, you gain 4 life.');
const TEXT = PRINTED.split('\n')[1] as string;

export const VALKYRIOR_SKYRIDER_SCRIPT: CardScript = {
  oracleId: VALKYRIOR_SKYRIDER.oracleId,
  name: VALKYRIOR_SKYRIDER.name,
  triggers: [
    {
      abilityId: 'etb-gain',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Valkyrior Skyrider — you gain 4 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [
          { t: 'LifeChanged', player: obj.controller, delta: 4, to: player.life + 4 },
        ];
      },
    },
  ],
};
