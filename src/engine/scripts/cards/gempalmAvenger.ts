// `Gempalm Avenger` - a cycleThisCard trigger pumping its controller's creatures
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GEMPALM_AVENGER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GEMPALM_AVENGER, "Cycling {2}{W} ({2}{W}, Discard this card: Draw a card.)\nWhen you cycle this card, Soldier creatures get +1/+1 and gain first strike until end of turn.");
const LINES = PRINTED.split('\n');

export const GEMPALM_AVENGER_SCRIPT: CardScript = {
  oracleId: GEMPALM_AVENGER.oracleId,
  name: GEMPALM_AVENGER.name,
  triggers: [
    {
      abilityId: 'cycleThisCard-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ["hand"],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.reason === 'cycling'),
      label: () => "Gempalm Avenger - creatures you control pumped until end of turn",
      resolve: (ctx, _self, _obj): readonly EventBody[] => {
        const out: EventBody[] = [];
        for (const inst of Object.values(ctx.state.cards)) {
          if (inst.zone.kind !== 'battlefield') continue;
          if (!ctx.derive(inst.id).typeLine.types.includes('Creature')) continue;
          if (!ctx.derive(inst.id).typeLine.subtypes.includes("Soldier")) continue;
          out.push({ t: 'PtModifiedUntilEndOfTurn', card: inst.id, power: 1, toughness: 1, keywords: ["firstStrike"] });
        }
        return out;
      },
    },
  ],
};
