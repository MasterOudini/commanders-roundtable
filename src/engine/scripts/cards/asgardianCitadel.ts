// `Asgardian Citadel` — Land, "This land enters tapped.\nWhen this land
// enters, you gain 1 life.\n{T}: Add {R} or {W}." The enters-tapped line is
// D134's built-in rule and the mana line is the engine's; the script owes
// exactly the trigger sentence (Radiant Fountain's shape). M6.4e, D162.

import { ASGARDIAN_CITADEL } from '../../../data/fixtures/engineCards';
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
  ASGARDIAN_CITADEL,
  'This land enters tapped.\nWhen this land enters, you gain 1 life.\n{T}: Add {R} or {W}.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const ASGARDIAN_CITADEL_SCRIPT: CardScript = {
  oracleId: ASGARDIAN_CITADEL.oracleId,
  name: ASGARDIAN_CITADEL.name,
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
      label: () => 'Asgardian Citadel — gain 1 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 1, to: player.life + 1 }];
      },
    },
  ],
};
