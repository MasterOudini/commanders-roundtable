// `Aven Battle Priest` — "Flying\nWhen this creature enters, you gain 3
// life." Radiant Fountain's self-ETB gain on a creature. M6.4e, D162.

import { AVEN_BATTLE_PRIEST } from '../../../data/fixtures/engineCards';
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
  AVEN_BATTLE_PRIEST,
  "Flying (This creature can't be blocked except by creatures with flying or reach.)\nWhen this creature enters, you gain 3 life.",
);
const TEXT = PRINTED.split('\n')[1] as string;

export const AVEN_BATTLE_PRIEST_SCRIPT: CardScript = {
  oracleId: AVEN_BATTLE_PRIEST.oracleId,
  name: AVEN_BATTLE_PRIEST.name,
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
      label: () => 'Aven Battle Priest — gain 3 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 3, to: player.life + 3 }];
      },
    },
  ],
};
