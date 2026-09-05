// `Anax and Cymede` - a heroic trigger pumping its controller's creatures
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ANAX_AND_CYMEDE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ANAX_AND_CYMEDE, "First strike, vigilance\nHeroic — Whenever you cast a spell that targets Anax and Cymede, creatures you control get +1/+1 and gain trample until end of turn.");
const LINES = PRINTED.split('\n');

export const ANAX_AND_CYMEDE_SCRIPT: CardScript = {
  oracleId: ANAX_AND_CYMEDE.oracleId,
  name: ANAX_AND_CYMEDE.name,
  triggers: [
    {
      abilityId: 'heroic-1',
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.targets.some((t) => t.kind === 'card' && t.id === self),
      label: () => "Anax and Cymede - creatures you control pumped until end of turn",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const out: EventBody[] = [];
        for (const inst of Object.values(ctx.state.cards)) {
          if (inst.zone.kind !== 'battlefield' || inst.controller !== obj.controller) continue;
          if (!ctx.derive(inst.id).typeLine.types.includes('Creature')) continue;
          out.push({ t: 'PtModifiedUntilEndOfTurn', card: inst.id, power: 1, toughness: 1, keywords: ["trample"] });
        }
        return out;
      },
    },
  ],
};
