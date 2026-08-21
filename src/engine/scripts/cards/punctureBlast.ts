// `Puncture Blast` — "Puncture Blast deals 3 damage to any target." The
// spell ITSELF has wither: creatures wear it as -1/-1 counters, players
// lose life (CR 702.90a) — Burn the Impure's derived rider printed on
// the card. The whole text, reminder included, is the claim (Marrow
// Shards' precedent). D236.

import { PUNCTURE_BLAST } from '../../../data/fixtures/engineCards';
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
  PUNCTURE_BLAST,
  'Wither (This deals damage to creatures in the form of -1/-1 counters.)\nPuncture Blast deals 3 damage to any target.',
);

export const PUNCTURE_BLAST_SCRIPT: CardScript = {
  oracleId: PUNCTURE_BLAST.oracleId,
  name: PUNCTURE_BLAST.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target) return [];
      if (target.kind === 'card' && ctx.state.cards[target.id]?.zone.kind !== 'battlefield') {
        return [];
      }
      if (target.kind === 'player' && !ctx.state.players[target.id]) return [];
      if (target.kind !== 'card' && target.kind !== 'player') return [];
      return [
        {
          t: 'DamageDealt',
          damages: [
            {
              source: self,
              target:
                target.kind === 'card'
                  ? { kind: 'card', id: target.id }
                  : { kind: 'player', id: target.id },
              amount: 3,
              deathtouch: false,
              lifelinkTo: null,
              isCommanderDamage: false,
              viaTrample: 0,
              toxic: 0,
              applyAs: target.kind === 'card' ? 'wither' : 'normal',
            },
          ],
        },
      ];
    },
  },
};
