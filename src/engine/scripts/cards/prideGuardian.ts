// `Pride Guardian` — "Whenever this creature blocks, you gain 3 life."
// The SELF-blocks trigger (Jedit's blocks arm without the token); the
// Defender line is the engine's. D235.

import { PRIDE_GUARDIAN } from '../../../data/fixtures/engineCards';
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
  PRIDE_GUARDIAN,
  'Defender\nWhenever this creature blocks, you gain 3 life.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const PRIDE_GUARDIAN_SCRIPT: CardScript = {
  oracleId: PRIDE_GUARDIAN.oracleId,
  name: PRIDE_GUARDIAN.name,
  triggers: [
    {
      abilityId: 'blocks-gain',
      text: TEXT,
      event: 'BlockersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'BlockersDeclared' && ev.blocks.some((b) => b.blocker === self),
      label: () => 'Pride Guardian — you gain 3 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 3, to: player.life + 3 }];
      },
    },
  ],
};
