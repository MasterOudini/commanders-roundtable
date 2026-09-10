// `Aven Farseer` - a turnedFaceUp trigger selfCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { AVEN_FARSEER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(AVEN_FARSEER, "Flying\nWhenever a permanent is turned face up, put a +1/+1 counter on this creature.");
const LINES = PRINTED.split('\n');

export const AVEN_FARSEER_SCRIPT: CardScript = {
  oracleId: AVEN_FARSEER.oracleId,
  name: AVEN_FARSEER.name,
  triggers: [
    {
      abilityId: 'turnedFaceUp-1',
      text: LINES[1] as string,
      event: 'FaceDownSet',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, _self, ev) =>
        ev.t === 'FaceDownSet' && !ev.faceDown,
      label: () => "Aven Farseer - a counter on it",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
};
