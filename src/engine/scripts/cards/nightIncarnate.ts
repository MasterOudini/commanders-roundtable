// `Night Incarnate` - a leavesBattlefield trigger pumping its controller's creatures
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { NIGHT_INCARNATE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(NIGHT_INCARNATE, "Deathtouch\nWhen this creature leaves the battlefield, all creatures get -3/-3 until end of turn.\nEvoke {3}{B} (You may cast this spell for its evoke cost. If you do, it's sacrificed when it enters.)");
const LINES = PRINTED.split('\n');

export const NIGHT_INCARNATE_SCRIPT: CardScript = {
  oracleId: NIGHT_INCARNATE.oracleId,
  name: NIGHT_INCARNATE.name,
  triggers: [
    {
      abilityId: 'leavesBattlefield-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind !== 'battlefield'),
      label: () => "Night Incarnate - creatures you control pumped until end of turn",
      resolve: (ctx, _self, _obj): readonly EventBody[] => {
        const out: EventBody[] = [];
        for (const inst of Object.values(ctx.state.cards)) {
          if (inst.zone.kind !== 'battlefield') continue;
          if (!ctx.derive(inst.id).typeLine.types.includes('Creature')) continue;
          out.push({ t: 'PtModifiedUntilEndOfTurn', card: inst.id, power: -3, toughness: -3 });
        }
        return out;
      },
    },
  ],
};
