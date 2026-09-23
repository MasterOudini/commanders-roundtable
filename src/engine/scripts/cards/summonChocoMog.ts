// `Summon: Choco/Mog` - a chapter trigger pumping its controller's creatures
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SUMMON_CHOCO_MOG } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SUMMON_CHOCO_MOG, "(As this Saga enters and after your draw step, add a lore counter. Sacrifice after IV.)\nI, II, III, IV — Stampede! — Other creatures you control get +1/+0 until end of turn.");
const LINES = PRINTED.split('\n');

export const SUMMON_CHOCO_MOG_SCRIPT: CardScript = {
  oracleId: SUMMON_CHOCO_MOG.oracleId,
  name: SUMMON_CHOCO_MOG.name,
  triggers: [
    {
      abilityId: 'chapter-1',
      text: LINES[1] as string,
      event: 'CountersChanged',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => {
        if (ev.t !== 'CountersChanged') return false;
        const after = ctx.state.cards[self]?.counters['lore'] ?? 0;
        return ev.changes.some((c) => c.card === self && c.kind === 'lore' && c.delta > 0 && [1,2,3,4].some((n) => n > after - c.delta && n <= after));
      },
      label: () => "Summon: Choco/Mog - creatures you control pumped until end of turn",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        const out: EventBody[] = [];
        for (const inst of Object.values(ctx.state.cards)) {
          if (inst.zone.kind !== 'battlefield' || inst.controller !== obj.controller) continue;
          if (inst.id === self) continue;
          if (!ctx.derive(inst.id).typeLine.types.includes('Creature')) continue;
          out.push({ t: 'PtModifiedUntilEndOfTurn', card: inst.id, power: 1, toughness: 0 });
        }
        return out;
      },
    },
  ],
};
