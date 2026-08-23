// `Vampire Envoy` — flying plus the becomes-tapped gain (Emmara's shape,
// D173): `PermanentsTapped` covers every tap path, so one self-filter is the
// whole condition. The keyword line never counts. D265.

import { VAMPIRE_ENVOY } from '../../../data/fixtures/engineCards';
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
  VAMPIRE_ENVOY,
  'Flying\nWhenever this creature becomes tapped, you gain 1 life.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const VAMPIRE_ENVOY_SCRIPT: CardScript = {
  oracleId: VAMPIRE_ENVOY.oracleId,
  name: VAMPIRE_ENVOY.name,
  triggers: [
    {
      abilityId: 'becomes-tapped',
      text: TEXT,
      event: 'PermanentsTapped',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'PermanentsTapped' && ev.cards.includes(self),
      label: () => 'Vampire Envoy — you gain 1 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 1, to: player.life + 1 }];
      },
    },
  ],
};
