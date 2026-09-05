// `Cave of Temptation` - an activation counterOnTarget
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CAVE_OF_TEMPTATION } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CAVE_OF_TEMPTATION, "{T}: Add {C}.\n{1}, {T}: Add one mana of any color.\n{4}, {T}, Sacrifice this land: Put two +1/+1 counters on target creature. Activate only as a sorcery.");
const LINES = PRINTED.split('\n');

export const CAVE_OF_TEMPTATION_SCRIPT: CardScript = {
  oracleId: CAVE_OF_TEMPTATION.oracleId,
  name: CAVE_OF_TEMPTATION.name,
  activated: [
    {
      ref: `${CAVE_OF_TEMPTATION.oracleId}#a2`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: target.id, kind: "+1/+1", delta: 2 }] }];
      },
    },
  ],
};
