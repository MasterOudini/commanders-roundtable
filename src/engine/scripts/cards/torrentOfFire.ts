// `Torrent of Fire` — the greatest-mana-value census over MY permanents
// (Rush of Knowledge's read, D242) fired at any target. An empty board is a
// true no-op rather than a 0-damage event. D261.

import { TORRENT_OF_FIRE } from '../../../data/fixtures/engineCards';
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
  TORRENT_OF_FIRE,
  'Torrent of Fire deals damage to any target equal to the greatest mana value among permanents you control.',
);

export const TORRENT_OF_FIRE_SCRIPT: CardScript = {
  oracleId: TORRENT_OF_FIRE.oracleId,
  name: TORRENT_OF_FIRE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target) return [];
      if (target.kind === 'stack') return [];
      if (target.kind === 'card' && ctx.state.cards[target.id]?.zone.kind !== 'battlefield') {
        return [];
      }

      let amount = 0;
      for (const id of ctx.state.zones.battlefield) {
        const inst = ctx.state.cards[id];
        if (!inst || inst.controller !== obj.controller) continue;
        const oc = ctx.oracle.byPrinting(inst.printingId);
        if (!oc) continue;
        if (oc.manaValue > amount) amount = oc.manaValue;
      }
      if (amount <= 0) return [];

      return [
        {
          t: 'DamageDealt',
          damages: [
            {
              source: self,
              target:
                target.kind === 'player'
                  ? { kind: 'player', id: target.id }
                  : { kind: 'card', id: target.id },
              amount,
              deathtouch: false,
              lifelinkTo: null,
              isCommanderDamage: false,
              viaTrample: 0,
              toxic: 0,
              applyAs: 'normal',
            },
          ],
        },
      ];
    },
  },
};
