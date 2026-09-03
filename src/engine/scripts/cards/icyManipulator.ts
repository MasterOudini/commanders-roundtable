// `Icy Manipulator` — {1}, {T}: tap an artifact, creature, or land. The
// three-noun list is the parser's (D293); the resolve is Glare of Subdual's.

import { ICY_MANIPULATOR } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(ICY_MANIPULATOR, '{1}, {T}: Tap target artifact, creature, or land.');

export const ICY_MANIPULATOR_SCRIPT: CardScript = {
  oracleId: ICY_MANIPULATOR.oracleId,
  name: ICY_MANIPULATOR.name,
  activated: [
    {
      ref: `${ICY_MANIPULATOR.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield' || card.tapped) return [];
        return [{ t: 'PermanentsTapped', cards: [target.id] }];
      },
    },
  ],
};
