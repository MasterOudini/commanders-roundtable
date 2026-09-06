// `Kin-Tree Warden` - an activation regenerate
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KIN_TREE_WARDEN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KIN_TREE_WARDEN, "{2}: Regenerate this creature.\nMorph {G} (You may cast this card face down as a 2/2 creature for {3}. Turn it face up any time for its morph cost.)");
const LINES = PRINTED.split('\n');

export const KIN_TREE_WARDEN_SCRIPT: CardScript = {
  oracleId: KIN_TREE_WARDEN.oracleId,
  name: KIN_TREE_WARDEN.name,
  activated: [
    {
      ref: `${KIN_TREE_WARDEN.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'RegenerationShieldAdded', card: self }];
      },
    },
  ],
};
