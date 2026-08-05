// `Adventurer's Inn` — Land — Town, "When this land enters, you gain 2 life."
// plus `{T}: Add {C}.` — Radiant Fountain's twin to the word, so the script is
// the same shape and the reasoning lives there (M6.4a, D158).

import { ADVENTURER_S_INN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ADVENTURER_S_INN, 'When this land enters, you gain 2 life.\n{T}: Add {C}.');
const TEXT = PRINTED.split('\n')[0] as string;

export const ADVENTURERS_INN_SCRIPT: CardScript = {
  oracleId: ADVENTURER_S_INN.oracleId,
  name: ADVENTURER_S_INN.name,
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
      label: () => "Adventurer's Inn — gain 2 life",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 2, to: player.life + 2 }];
      },
    },
  ],
};
