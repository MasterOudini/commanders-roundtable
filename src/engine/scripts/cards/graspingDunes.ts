// `Grasping Dunes` - an activation counterOnTarget
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GRASPING_DUNES } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GRASPING_DUNES, "{T}: Add {C}.\n{1}, {T}, Sacrifice this land: Put a -1/-1 counter on target creature. Activate only as a sorcery.");
const LINES = PRINTED.split('\n');

export const GRASPING_DUNES_SCRIPT: CardScript = {
  oracleId: GRASPING_DUNES.oracleId,
  name: GRASPING_DUNES.name,
  activated: [
    {
      ref: `${GRASPING_DUNES.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: target.id, kind: "-1/-1", delta: 1 }] }];
      },
    },
  ],
};
