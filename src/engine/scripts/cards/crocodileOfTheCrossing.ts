// `Crocodile of the Crossing` — "Haste\nWhen this creature enters, put a
// -1/-1 counter on target creature you control." A targeted ETB whose
// restriction points at the CONTROLLER's own board — targetParse reads "you
// control" and the veil enforces it; the def re-checks the zone and writes
// the counter `derive` already sums at layer 7d. M6.4l, D169.

import { CROCODILE_OF_THE_CROSSING } from '../../../data/fixtures/engineCards';
import { parseTargetClauses } from '../../../data/targetParse';
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
  CROCODILE_OF_THE_CROSSING,
  'Haste\nWhen this creature enters, put a -1/-1 counter on target creature you control.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const CROCODILE_OF_THE_CROSSING_SCRIPT: CardScript = {
  oracleId: CROCODILE_OF_THE_CROSSING.oracleId,
  name: CROCODILE_OF_THE_CROSSING.name,
  triggers: [
    {
      abilityId: 'etb',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(TEXT),
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Crocodile of the Crossing — put a -1/-1 counter on target creature you control',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: target.id, kind: '-1/-1', delta: 1 }] }];
      },
    },
  ],
};
