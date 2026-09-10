// `Cyan, Vengeful Samurai` - a cardLeavesYourGraveyard trigger selfCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CYAN_VENGEFUL_SAMURAI } from '../../../data/fixtures/engineCards';
import { faceOf } from '../../oracle';
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

const PRINTED = printed(CYAN_VENGEFUL_SAMURAI, "This spell costs {1} less to cast for each creature card in your graveyard.\nDouble strike\nWhenever one or more creature cards leave your graveyard, put a +1/+1 counter on Cyan.");
const LINES = PRINTED.split('\n');

export const CYAN_VENGEFUL_SAMURAI_SCRIPT: CardScript = {
  oracleId: CYAN_VENGEFUL_SAMURAI.oracleId,
  name: CYAN_VENGEFUL_SAMURAI.name,
  triggers: [
    {
      abilityId: 'cardLeavesYourGraveyard-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some((m) => {
          if (m.from.kind !== 'graveyard') return false;
          if (m.from.player !== ctx.query.controllerOf(self)) return false;
          const inst = ctx.state.cards[m.card];
          const oc = inst ? ctx.oracle.byPrinting(inst.printingId) : undefined;
          if (!oc) return false;
          const f = faceOf(oc, inst?.faceIndex ?? 0);
          return f.typeLine.types.includes('Creature');
        }),
      label: () => "Cyan, Vengeful Samurai - a counter on it",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
};
