// `Their Name Is Death` — the negated-type wipe (Breath Weapon's shape,
// D201): every creature dies EXCEPT the artifact ones, which walk away
// because the exemption is a type rather than a keyword. Per-object
// indestructible on top, as every sweep since D192's Damnation. D259.

import { THEIR_NAME_IS_DEATH } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';
import type { InstanceId } from '../../types/ids';

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

const TEXT = printed(THEIR_NAME_IS_DEATH, 'Destroy all nonartifact creatures.');

export const THEIR_NAME_IS_DEATH_SCRIPT: CardScript = {
  oracleId: THEIR_NAME_IS_DEATH.oracleId,
  name: THEIR_NAME_IS_DEATH.name,
  spell: {
    text: TEXT,
    resolve: (ctx): readonly EventBody[] => {
      const moves: {
        card: InstanceId;
        from: { kind: 'battlefield'; player: string };
        to: { kind: 'graveyard'; player: string };
      }[] = [];
      for (const id of ctx.state.zones.battlefield) {
        const inst = ctx.state.cards[id];
        if (!inst) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Creature')) continue;
        if (d.typeLine.types.includes('Artifact')) continue;
        if (d.keywords.has('indestructible')) continue;
        moves.push({
          card: id,
          from: { kind: 'battlefield', player: inst.controller },
          to: { kind: 'graveyard', player: inst.owner },
        });
      }
      if (moves.length === 0) return [];
      return [{ t: 'CardsMoved', moves }];
    },
  },
};
