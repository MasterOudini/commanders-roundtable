// `Venerable Monk` — the plain ETB life gain at 2. One printed shape across
// three oracle ids this arc (Tireless Missionaries D260, Turntimber Ascetic
// D263, this), so it is generated from one base rather than copied. D265.

import { VENERABLE_MONK } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VENERABLE_MONK, 'When this creature enters, you gain 2 life.');
const TEXT = PRINTED.split('\n')[0] as string;

export const VENERABLE_MONK_SCRIPT: CardScript = {
  oracleId: VENERABLE_MONK.oracleId,
  name: VENERABLE_MONK.name,
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
      label: () => 'Venerable Monk — you gain 2 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [
          { t: 'LifeChanged', player: obj.controller, delta: 2, to: player.life + 2 },
        ];
      },
    },
  ],
};
