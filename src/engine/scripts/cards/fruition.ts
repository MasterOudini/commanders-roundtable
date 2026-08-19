// `Fruition` — "You gain 1 life for each Forest on the battlefield." The
// first UNTARGETED SpellDef, and the first board-computed spell: "for each"
// is outside `effectParse`'s vocabulary, so this card was manual-only until
// the seam. Counts EVERY Forest on the battlefield (any controller — the
// card says so), by DERIVED subtypes so a Dryad Arbor or an animated
// forest-typed land counts the way the rules count it. D187.

import { FRUITION } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(FRUITION, 'You gain 1 life for each Forest on the battlefield.');

export const FRUITION_SCRIPT: CardScript = {
  oracleId: FRUITION.oracleId,
  name: FRUITION.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const player = ctx.state.players[obj.controller];
      if (!player || player.hasLost) return [];
      let forests = 0;
      for (const id of ctx.state.zones.battlefield) {
        if (ctx.derive(id).typeLine.subtypes.includes('Forest')) forests++;
      }
      if (forests === 0) return [];
      return [
        { t: 'LifeChanged', player: obj.controller, delta: forests, to: player.life + forests },
      ];
    },
  },
};
