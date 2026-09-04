// `Balmor, Battlemage Captain` - a castInstantSorcery trigger pumping its controller's creatures
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BALMOR_BATTLEMAGE_CAPTAIN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BALMOR_BATTLEMAGE_CAPTAIN, "Flying\nWhenever you cast an instant or sorcery spell, creatures you control get +1/+0 and gain trample until end of turn.");
const LINES = PRINTED.split('\n');

export const BALMOR_BATTLEMAGE_CAPTAIN_SCRIPT: CardScript = {
  oracleId: BALMOR_BATTLEMAGE_CAPTAIN.oracleId,
  name: BALMOR_BATTLEMAGE_CAPTAIN.name,
  triggers: [
    {
      abilityId: 'castInstantSorcery-1',
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.card !== null && ctx.derive(ev.obj.card).typeLine.types.some((t) => t === 'Instant' || t === 'Sorcery'),
      label: () => "Balmor, Battlemage Captain - creatures you control pumped until end of turn",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const out: EventBody[] = [];
        for (const inst of Object.values(ctx.state.cards)) {
          if (inst.zone.kind !== 'battlefield' || inst.controller !== obj.controller) continue;
          if (!ctx.derive(inst.id).typeLine.types.includes('Creature')) continue;
          out.push({ t: 'PtModifiedUntilEndOfTurn', card: inst.id, power: 1, toughness: 0, keywords: ["trample"] });
        }
        return out;
      },
    },
  ],
};
