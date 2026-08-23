// `Toil to Renown` — the TAPPED-permanent census as life. Three types are
// counted and a permanent that is two of them (an artifact creature, a
// creature land) counts ONCE, because the card asks for a count of
// permanents rather than a sum per type. D260.

import { TOIL_TO_RENOWN } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(
  TOIL_TO_RENOWN,
  'You gain 1 life for each tapped artifact, creature, and land you control.',
);

const COUNTED = ['Artifact', 'Creature', 'Land'];

export const TOIL_TO_RENOWN_SCRIPT: CardScript = {
  oracleId: TOIL_TO_RENOWN.oracleId,
  name: TOIL_TO_RENOWN.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      let n = 0;
      for (const id of ctx.state.zones.battlefield) {
        const inst = ctx.state.cards[id];
        if (!inst || inst.controller !== obj.controller || !inst.tapped) continue;
        const types = ctx.derive(id).typeLine.types;
        if (types.some((t) => COUNTED.includes(t))) n += 1;
      }
      if (n === 0) return [];
      const me = ctx.state.players[obj.controller];
      if (!me || me.hasLost) return [];
      return [{ t: 'LifeChanged', player: obj.controller, delta: n, to: me.life + n }];
    },
  },
};
