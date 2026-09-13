// `Moriok Rigger` - a cardPutIntoGraveyard trigger selfCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MORIOK_RIGGER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MORIOK_RIGGER, "Whenever an artifact is put into a graveyard from the battlefield, you may put a +1/+1 counter on this creature.");

export const MORIOK_RIGGER_SCRIPT: CardScript = {
  oracleId: MORIOK_RIGGER.oracleId,
  name: MORIOK_RIGGER.name,
  triggers: [
    {
      abilityId: 'cardPutIntoGraveyard-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      looksBack: true,
      matches: (ctx, _self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'graveyard' && m.from.kind === 'battlefield' && ctx.derive(m.card).typeLine.types.includes('Artifact'),
        ),
      label: () => "Moriok Rigger - a counter on it",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
};
