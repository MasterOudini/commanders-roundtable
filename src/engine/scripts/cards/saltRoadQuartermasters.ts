// `Salt Road Quartermasters` - a static entersWithCounters, an activation counterOnTarget
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SALT_ROAD_QUARTERMASTERS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SALT_ROAD_QUARTERMASTERS, "This creature enters with two +1/+1 counters on it.\n{2}{G}, Remove a +1/+1 counter from this creature: Put a +1/+1 counter on target creature.");
const LINES = PRINTED.split('\n');

export const SALT_ROAD_QUARTERMASTERS_SCRIPT: CardScript = {
  oracleId: SALT_ROAD_QUARTERMASTERS.oracleId,
  name: SALT_ROAD_QUARTERMASTERS.name,
  activated: [
    {
      ref: `${SALT_ROAD_QUARTERMASTERS.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: target.id, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
  replacements: [
    {
      abilityId: 'enters-with-0',
      text: LINES[0] as string,
      activeZones: ['battlefield'],
      // CR 614.12 - offered to the entering card itself (D319).
      applies: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      replace: (_ctx, self, ev): readonly EventBody[] => [ev, { t: 'CountersChanged', changes: [{ card: self, kind: '+1/+1', delta: 2 }] }],
    },
  ],
};
