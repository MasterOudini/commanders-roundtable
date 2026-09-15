// `Burdened Stoneback` - a static entersWithCounters, an activation pumpTarget
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BURDENED_STONEBACK } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BURDENED_STONEBACK, "This creature enters with two -1/-1 counters on it.\n{1}{W}, Remove a counter from this creature: Target creature gains indestructible until end of turn. Activate only as a sorcery. (Damage and effects that say \"destroy\" don't destroy it. If its toughness is 0 or less, it still dies.)");
const LINES = PRINTED.split('\n');

export const BURDENED_STONEBACK_SCRIPT: CardScript = {
  oracleId: BURDENED_STONEBACK.oracleId,
  name: BURDENED_STONEBACK.name,
  activated: [
    {
      ref: `${BURDENED_STONEBACK.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 0, toughness: 0, keywords: ["indestructible"] }];
      },
    },
  ],
  replacements: [
    {
      abilityId: 'enters-with-0',
      text: LINES[0] as string,
      activeZones: ['battlefield'],
      // CR 614.12 - offered to the entering card itself (D371).
      applies: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      replace: (_ctx, self, ev): readonly EventBody[] => [ev, { t: 'CountersChanged', changes: [{ card: self, kind: "-1/-1", delta: 2 }] }],
    },
  ],
};
