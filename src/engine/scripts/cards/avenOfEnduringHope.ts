// `Aven of Enduring Hope` — "Flying\nWhen this creature enters, you gain 3
// life." Aven Battle Priest's exact shape. M6.4f, D163.

import { AVEN_OF_ENDURING_HOPE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(AVEN_OF_ENDURING_HOPE, 'Flying\nWhen this creature enters, you gain 3 life.');
const TEXT = PRINTED.split('\n')[1] as string;

export const AVEN_OF_ENDURING_HOPE_SCRIPT: CardScript = {
  oracleId: AVEN_OF_ENDURING_HOPE.oracleId,
  name: AVEN_OF_ENDURING_HOPE.name,
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
      label: () => 'Aven of Enduring Hope — gain 3 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 3, to: player.life + 3 }];
      },
    },
  ],
};
