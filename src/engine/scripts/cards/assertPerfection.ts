// `Assert Perfection` — my creature gets +1/+0 until cleanup, then deals its
// (pumped) power in damage to up to one creature an opponent controls; the
// two targets are told apart by controller, not position (D288).

import { ASSERT_PERFECTION } from '../../../data/fixtures/engineCards';
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
  ASSERT_PERFECTION,
  'Target creature you control gets +1/+0 until end of turn. It deals damage equal to its power to up to one target creature an opponent controls.',
);

export const ASSERT_PERFECTION_SCRIPT: CardScript = {
  oracleId: ASSERT_PERFECTION.oracleId,
  name: ASSERT_PERFECTION.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const cards = obj.targets.filter((t) => t.kind === 'card');
      const mine = cards.find((t) => ctx.state.cards[t.id]?.controller === obj.controller);
      const theirs = cards.find((t) => ctx.state.cards[t.id]?.controller !== obj.controller);
      if (!mine || ctx.state.cards[mine.id]?.zone.kind !== 'battlefield') return [];
      const events: EventBody[] = [{ t: 'PtModifiedUntilEndOfTurn', card: mine.id, power: 1, toughness: 0, keywords: [] }];
      if (theirs && ctx.state.cards[theirs.id]?.zone.kind === 'battlefield') {
        const power = (ctx.derive(mine.id).power ?? 0) + 1;
        if (power > 0) {
          events.push({
            t: 'DamageDealt',
            damages: [
              {
                source: mine.id,
                target: { kind: 'card', id: theirs.id },
                amount: power,
                deathtouch: ctx.derive(mine.id).keywords.has('deathtouch'),
                lifelinkTo: ctx.derive(mine.id).keywords.has('lifelink') ? obj.controller : null,
                isCommanderDamage: false,
                viaTrample: 0,
                toxic: 0,
                applyAs: 'normal',
              },
            ],
          });
        }
      }
      return events;
    },
  },
};
