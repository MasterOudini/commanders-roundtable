// `Ishai, Ojutai Dragonspeaker` - a opponentCastsSpell trigger selfCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ISHAI_OJUTAI_DRAGONSPEAKER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ISHAI_OJUTAI_DRAGONSPEAKER, "Flying\nWhenever an opponent casts a spell, put a +1/+1 counter on Ishai.\nPartner (You can have two commanders if both have partner.)");
const LINES = PRINTED.split('\n');

export const ISHAI_OJUTAI_DRAGONSPEAKER_SCRIPT: CardScript = {
  oracleId: ISHAI_OJUTAI_DRAGONSPEAKER.oracleId,
  name: ISHAI_OJUTAI_DRAGONSPEAKER.name,
  triggers: [
    {
      abilityId: 'opponentCastsSpell-1',
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.controller !== ctx.query.controllerOf(self),
      label: () => "Ishai, Ojutai Dragonspeaker - a counter on it",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
};
