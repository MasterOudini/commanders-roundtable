// `Aspect of Hydra` — "Target creature gets +X/+X until end of turn, where X
// is your devotion to green." Devotion (CR 700.5) counts every mana symbol
// containing {G} in the mana costs of permanents you control: the parsed
// `ManaCost` gives plain pips as `colored.G` and each hybrid/Phyrexian symbol
// as one `hybrids` entry, read off the face the permanent is showing — a
// transformed back face has a null cost and correctly contributes nothing.
// D198.

import { ASPECT_OF_HYDRA } from '../../../data/fixtures/engineCards';
import { faceOf } from '../../oracle';
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
  ASPECT_OF_HYDRA,
  'Target creature gets +X/+X until end of turn, where X is your devotion to green. (Each {G} in the mana costs of permanents you control counts toward your devotion to green.)',
);

export const ASPECT_OF_HYDRA_SCRIPT: CardScript = {
  oracleId: ASPECT_OF_HYDRA.oracleId,
  name: ASPECT_OF_HYDRA.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
      let devotion = 0;
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== obj.controller) continue;
        const oc = ctx.oracle.byPrinting(card.printingId);
        if (!oc) continue;
        const cost = faceOf(oc, card.faceIndex).manaCost;
        if (!cost) continue;
        devotion += cost.colored.G;
        devotion += cost.hybrids.filter((h) =>
          h.options.some((o) => o.kind === 'color' && o.color === 'G'),
        ).length;
      }
      if (devotion === 0) return [];
      return [
        { t: 'PtModifiedUntilEndOfTurn', card: target.id, power: devotion, toughness: devotion },
      ];
    },
  },
};
