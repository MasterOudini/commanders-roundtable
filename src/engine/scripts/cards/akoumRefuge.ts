// `Akoum Refuge` — "This land enters tapped.\nWhen this land enters, you gain
// 1 life.\n{T}: Add {B} or {R}." A.I.M. Labs' twin to the word. M6.4c, D160.

import { AKOUM_REFUGE } from '../../../data/fixtures/engineCards';
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
  AKOUM_REFUGE,
  'This land enters tapped.\nWhen this land enters, you gain 1 life.\n{T}: Add {B} or {R}.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const AKOUM_REFUGE_SCRIPT: CardScript = {
  oracleId: AKOUM_REFUGE.oracleId,
  name: AKOUM_REFUGE.name,
  triggers: [
    {
      abilityId: 'etb',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Akoum Refuge — gain 1 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 1, to: player.life + 1 }];
      },
    },
  ],
};
