// `Gempalm Sorcerer` - a cycleThisCard trigger pumping its controller's creatures
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GEMPALM_SORCERER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GEMPALM_SORCERER, "Cycling {2}{U} ({2}{U}, Discard this card: Draw a card.)\nWhen you cycle this card, Wizard creatures gain flying until end of turn.");
const LINES = PRINTED.split('\n');

export const GEMPALM_SORCERER_SCRIPT: CardScript = {
  oracleId: GEMPALM_SORCERER.oracleId,
  name: GEMPALM_SORCERER.name,
  triggers: [
    {
      abilityId: 'cycleThisCard-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ["hand"],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.reason === 'cycling'),
      label: () => "Gempalm Sorcerer - creatures you control pumped until end of turn",
      resolve: (ctx, _self, _obj): readonly EventBody[] => {
        const out: EventBody[] = [];
        for (const inst of Object.values(ctx.state.cards)) {
          if (inst.zone.kind !== 'battlefield') continue;
          if (!ctx.derive(inst.id).typeLine.types.includes('Creature')) continue;
          if (!ctx.derive(inst.id).typeLine.subtypes.includes("Wizard")) continue;
          out.push({ t: 'PtModifiedUntilEndOfTurn', card: inst.id, power: 0, toughness: 0, keywords: ["flying"] });
        }
        return out;
      },
    },
  ],
};
