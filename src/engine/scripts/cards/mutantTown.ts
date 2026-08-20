// `Mutant Town` — Asgardian Citadel's shape: the tapped entry is the
// built-in, the mana line is the engine's, and the def claims only the ETB
// gain. D227.

import { MUTANT_TOWN } from '../../../data/fixtures/engineCards';
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
  MUTANT_TOWN,
  'This land enters tapped.\nWhen this land enters, you gain 1 life.\n{T}: Add {G} or {U}.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const MUTANT_TOWN_SCRIPT: CardScript = {
  oracleId: MUTANT_TOWN.oracleId,
  name: MUTANT_TOWN.name,
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
      label: () => 'Mutant Town — gain 1 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 1, to: player.life + 1 }];
      },
    },
  ],
};
