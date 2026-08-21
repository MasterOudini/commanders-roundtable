// `Skulduggery` — "Until end of turn, target creature you control gets +1/+1
// and target creature an opponent controls gets -1/-1." The PROBED plain
// two-target sentence (D241's boundary): two confident specs, both
// controllers ENFORCED at the aim, each side its own carrier entry. D248.

import { SKULDUGGERY } from '../../../data/fixtures/engineCards';
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
  SKULDUGGERY,
  'Until end of turn, target creature you control gets +1/+1 and target creature an opponent controls gets -1/-1.',
);

export const SKULDUGGERY_SCRIPT: CardScript = {
  oracleId: SKULDUGGERY.oracleId,
  name: SKULDUGGERY.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const events: EventBody[] = [];
      const mine = obj.targets[0];
      if (mine && mine.kind === 'card' && ctx.state.cards[mine.id]?.zone.kind === 'battlefield') {
        events.push({ t: 'PtModifiedUntilEndOfTurn', card: mine.id, power: 1, toughness: 1 });
      }
      const theirs = obj.targets[1];
      if (
        theirs &&
        theirs.kind === 'card' &&
        ctx.state.cards[theirs.id]?.zone.kind === 'battlefield'
      ) {
        events.push({ t: 'PtModifiedUntilEndOfTurn', card: theirs.id, power: -1, toughness: -1 });
      }
      return events;
    },
  },
};
