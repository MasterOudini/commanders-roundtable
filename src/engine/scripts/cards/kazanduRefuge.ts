// `Kazandu Refuge` — Land, "This land enters tapped.\nWhen this land
// enters, you gain 1 life.\n{T}: Add {R} or {G}." The Fisk Tower shape in
// Gruul colours. M6.4aa, D183.

import { KAZANDU_REFUGE } from '../../../data/fixtures/engineCards';
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
  KAZANDU_REFUGE,
  'This land enters tapped.\nWhen this land enters, you gain 1 life.\n{T}: Add {R} or {G}.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const KAZANDU_REFUGE_SCRIPT: CardScript = {
  oracleId: KAZANDU_REFUGE.oracleId,
  name: KAZANDU_REFUGE.name,
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
      label: () => 'Kazandu Refuge — gain 1 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 1, to: player.life + 1 }];
      },
    },
  ],
};
