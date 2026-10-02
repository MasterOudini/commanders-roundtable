// `Walking Archive` - a static entersWithCounters, a eachUpkeep trigger vocab, an activation selfCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WALKING_ARCHIVE } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
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

const PRINTED = printed(WALKING_ARCHIVE, "Defender (This creature can't attack.)\nThis creature enters with a +1/+1 counter on it.\nAt the beginning of each player's upkeep, that player draws a card for each +1/+1 counter on this creature.\n{2}{W}{U}: Put a +1/+1 counter on this creature.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Target player draws a card for each +1/+1 counter on ~.", WALKING_ARCHIVE.name);
const VOCAB_T_L2 = vocabularyTargets("Target player draws a card for each +1/+1 counter on ~.");

export const WALKING_ARCHIVE_SCRIPT: CardScript = {
  oracleId: WALKING_ARCHIVE.oracleId,
  name: WALKING_ARCHIVE.name,
  activated: [
    {
      ref: `${WALKING_ARCHIVE.oracleId}#a0`,
      text: LINES[3] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
  triggers: [
    {
      abilityId: 'eachUpkeep-2',
      text: LINES[2] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      playerOf: (ctx) => ctx.state.turn.activePlayer,
      matches: (_ctx, _self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep',
      label: () => "Walking Archive - Target player draws a card for each +1/+1 counter on ~.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.player === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: VOCAB_T_L2.map(() => ({ kind: 'player' as const, id: obj.player as string })) }, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
  replacements: [
    {
      abilityId: 'enters-with-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      // CR 614.12 - offered to the entering card itself (D371).
      applies: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      replace: (_ctx, self, ev): readonly EventBody[] => [ev, { t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }],
    },
  ],
};
