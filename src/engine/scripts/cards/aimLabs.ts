// `A.I.M. Labs` — "This land enters tapped.\nWhen this land enters, you gain 1
// life.\n{T}: Add {U} or {B}." Enters-tapped is D134's built-in, the mana line
// is the engine's, and the def owes the gain — a Radiant Fountain that also
// arrives turned. M6.4c, D160.

import { A_I_M_LABS } from '../../../data/fixtures/engineCards';
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
  A_I_M_LABS,
  'This land enters tapped.\nWhen this land enters, you gain 1 life.\n{T}: Add {U} or {B}.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const AIM_LABS_SCRIPT: CardScript = {
  oracleId: A_I_M_LABS.oracleId,
  name: A_I_M_LABS.name,
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
      label: () => 'A.I.M. Labs — gain 1 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 1, to: player.life + 1 }];
      },
    },
  ],
};
