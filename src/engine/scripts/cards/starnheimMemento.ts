// `Starnheim Memento` - an activation pumpTarget
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { STARNHEIM_MEMENTO } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(STARNHEIM_MEMENTO, "{T}: Add {W}.\n{1}{W}, {T}: Target creature gets +1/+1 and gains flying until end of turn. Activate only as a sorcery.");
const LINES = PRINTED.split('\n');

export const STARNHEIM_MEMENTO_SCRIPT: CardScript = {
  oracleId: STARNHEIM_MEMENTO.oracleId,
  name: STARNHEIM_MEMENTO.name,
  activated: [
    {
      ref: `${STARNHEIM_MEMENTO.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 1, toughness: 1, keywords: ["flying"] }];
      },
    },
  ],
};
