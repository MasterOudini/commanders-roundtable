// `Argothian Treefolk` - a CONTINUOUS prevention effect (CR 615, D385): a `PreventionDef` the
// replacement funnel asks about every damage entry, which absorbs the whole entry and spends
// nothing - the other half of D382 one-shot shield. Generated from one table row.

import { ARGOTHIAN_TREEFOLK } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';

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

const PRINTED = printed(ARGOTHIAN_TREEFOLK, "Prevent all damage that would be dealt to this creature by artifact sources.");

export const ARGOTHIAN_TREEFOLK_SCRIPT: CardScript = {
  oracleId: ARGOTHIAN_TREEFOLK.oracleId,
  name: ARGOTHIAN_TREEFOLK.name,
  prevention: [
    {
      abilityId: 'prevent-0',
      text: PRINTED,
      activeZones: ['battlefield'],
      // CR 615 - asked in the funnel per damage entry; a true absorbs the entry whole.
      prevents: (ctx, self, entry, _isCombat) => {
        const tid = entry.target.kind === 'card' ? entry.target.id : null;
        const src = entry.source;
        return (tid === self) && (ctx.state.cards[src] !== undefined && ctx.derive(src).typeLine.types.includes('Artifact'));
      },
    },
  ],
};
