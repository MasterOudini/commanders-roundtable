// `Hard-Hitting Question` — Bite Down's exact printed text on its own
// oracle id: the one-way bite with the biter's derived riders. D216.

import { HARD_HITTING_QUESTION } from '../../../data/fixtures/engineCards';
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
  HARD_HITTING_QUESTION,
  "Target creature you control deals damage equal to its power to target creature or planeswalker you don't control.",
);

export const HARD_HITTING_QUESTION_SCRIPT: CardScript = {
  oracleId: HARD_HITTING_QUESTION.oracleId,
  name: HARD_HITTING_QUESTION.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const mine = obj.targets[0];
      const theirs = obj.targets[1];
      if (!mine || mine.kind !== 'card') return [];
      const source = ctx.state.cards[mine.id];
      if (source?.zone.kind !== 'battlefield') return [];
      if (!theirs || theirs.kind !== 'card') return [];
      if (ctx.state.cards[theirs.id]?.zone.kind !== 'battlefield') return [];
      const d = ctx.derive(mine.id);
      const power = d.power ?? 0;
      if (power <= 0) return [];
      return [
        {
          t: 'DamageDealt',
          damages: [
            {
              source: mine.id,
              target: { kind: 'card', id: theirs.id },
              amount: power,
              deathtouch: d.keywords.has('deathtouch'),
              lifelinkTo: d.keywords.has('lifelink') ? source.controller : null,
              isCommanderDamage: false,
              viaTrample: 0,
              toxic: d.toxicAmount,
              applyAs:
                d.keywords.has('infect') || d.keywords.has('wither') ? 'wither' : 'normal',
            },
          ],
        },
      ];
    },
  },
};
