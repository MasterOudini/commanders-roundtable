// `Dimension X` — Land, "This land enters tapped.\nWhen this land enters,
// you gain 1 life.\n{T}: Add {R} or {W}." Asgardian Citadel's EXACT printed
// text on a second oracle id (Benalish Trapper's precedent, D164) — the
// enters-tapped line is D134's rule, the mana line the engine's, the def owes
// the trigger sentence. M6.4o, D171.

import { DIMENSION_X } from '../../../data/fixtures/engineCards';
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
  DIMENSION_X,
  'This land enters tapped.\nWhen this land enters, you gain 1 life.\n{T}: Add {R} or {W}.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const DIMENSION_X_SCRIPT: CardScript = {
  oracleId: DIMENSION_X.oracleId,
  name: DIMENSION_X.name,
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
      label: () => 'Dimension X — gain 1 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 1, to: player.life + 1 }];
      },
    },
  ],
};
