// `Huatli's Final Strike` — +1/+0 first, then the bite reads the power
// AFTER its own pump (Ambuscade's arithmetic). D218.

import { HUATLI_S_FINAL_STRIKE } from '../../../data/fixtures/engineCards';
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
  HUATLI_S_FINAL_STRIKE,
  'Target creature you control gets +1/+0 until end of turn. It deals damage equal to its power to target creature an opponent controls.',
);

export const HUATLIS_FINAL_STRIKE_SCRIPT: CardScript = {
  oracleId: HUATLI_S_FINAL_STRIKE.oracleId,
  name: HUATLI_S_FINAL_STRIKE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const mine = obj.targets[0];
      const theirs = obj.targets[1];
      if (!mine || mine.kind !== 'card') return [];
      const source = ctx.state.cards[mine.id];
      if (source?.zone.kind !== 'battlefield') return [];
      const events: EventBody[] = [
        { t: 'PtModifiedUntilEndOfTurn', card: mine.id, power: 1, toughness: 0 },
      ];
      if (!theirs || theirs.kind !== 'card') return events;
      if (ctx.state.cards[theirs.id]?.zone.kind !== 'battlefield') return events;
      const d = ctx.derive(mine.id);
      const power = (d.power ?? 0) + 1;
      if (power <= 0) return events;
      events.push({
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
            applyAs: d.keywords.has('infect') || d.keywords.has('wither') ? 'wither' : 'normal',
          },
        ],
      });
      return events;
    },
  },
};
