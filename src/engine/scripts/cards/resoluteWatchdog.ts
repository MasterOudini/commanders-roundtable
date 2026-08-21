// `Resolute Watchdog` — "{1}, Sacrifice this creature: Target creature
// you control gains indestructible until end of turn." The self-sac
// grant on D194's carrier; the Defender line is the engine's. D239.

import { RESOLUTE_WATCHDOG } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(
  RESOLUTE_WATCHDOG,
  'Defender\n{1}, Sacrifice this creature: Target creature you control gains indestructible until end of turn. ' +
    '(Damage and effects that say "destroy" don\'t destroy it.)',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const RESOLUTE_WATCHDOG_SCRIPT: CardScript = {
  oracleId: RESOLUTE_WATCHDOG.oracleId,
  name: RESOLUTE_WATCHDOG.name,
  activated: [
    {
      ref: `${RESOLUTE_WATCHDOG.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [
          {
            t: 'PtModifiedUntilEndOfTurn',
            card: target.id,
            power: 0,
            toughness: 0,
            keywords: ['indestructible'],
          },
        ];
      },
    },
  ],
};
