// `Jedit's Dragoons` — "When this creature enters, you gain 4 life."
// Inspiring Cleric's twin in the same batch, past a Vigilance line. M6.4z,
// D182.

import { JEDIT_S_DRAGOONS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(JEDIT_S_DRAGOONS, 'Vigilance\nWhen this creature enters, you gain 4 life.');
const TEXT = PRINTED.split('\n')[1] as string;

export const JEDITS_DRAGOONS_SCRIPT: CardScript = {
  oracleId: JEDIT_S_DRAGOONS.oracleId,
  name: JEDIT_S_DRAGOONS.name,
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
      label: () => "Jedit's Dragoons — gain 4 life",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 4, to: player.life + 4 }];
      },
    },
  ],
};
