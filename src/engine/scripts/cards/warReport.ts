// `War Report` — gain life equal to creatures PLUS artifacts on the
// battlefield, every controller's.
//
// ⚠️ "plus", not "or": an artifact creature is counted TWICE, once in each
// term. That is the whole card, and the branch the test pins. D267.

import { WAR_REPORT } from '../../../data/fixtures/engineCards';
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
  WAR_REPORT,
  'You gain life equal to the number of creatures on the battlefield plus the number of artifacts on the battlefield.',
);

export const WAR_REPORT_SCRIPT: CardScript = {
  oracleId: WAR_REPORT.oracleId,
  name: WAR_REPORT.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      let amount = 0;
      for (const id of ctx.state.zones.battlefield) {
        if (!ctx.state.cards[id]) continue;
        const types = ctx.derive(id).typeLine.types;
        if (types.includes('Creature')) amount += 1;
        if (types.includes('Artifact')) amount += 1;
      }
      if (amount === 0) return [];
      const me = ctx.state.players[obj.controller];
      if (!me || me.hasLost) return [];
      return [{ t: 'LifeChanged', player: obj.controller, delta: amount, to: me.life + amount }];
    },
  },
};
