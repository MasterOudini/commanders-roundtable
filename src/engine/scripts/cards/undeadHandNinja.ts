// `Undead Hand Ninja` - a cardLeavesYourGraveyard trigger drain
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { UNDEAD_HAND_NINJA } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(UNDEAD_HAND_NINJA, "Deathtouch\nWhenever one or more creature cards leave your graveyard, each opponent loses 1 life and you gain 1 life.");
const LINES = PRINTED.split('\n');

export const UNDEAD_HAND_NINJA_SCRIPT: CardScript = {
  oracleId: UNDEAD_HAND_NINJA.oracleId,
  name: UNDEAD_HAND_NINJA.name,
  triggers: [
    {
      abilityId: 'cardLeavesYourGraveyard-1',
      text: LINES[1] as string,
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
      label: () => "Undead Hand Ninja - drain",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const out: EventBody[] = [];
        for (const [pid, p] of Object.entries(ctx.state.players)) {
          if (pid === obj.controller) continue;
          out.push({ t: 'LifeChanged', player: pid, delta: -1, to: p.life - 1 });
        }
        const me = ctx.state.players[obj.controller];
        if (me) out.push({ t: 'LifeChanged', player: obj.controller, delta: 1, to: me.life + 1 });
        return out;
      },
    },
  ],
};
