// `Raff, Weatherlight Stalwart` - a castInstantSorcery trigger vocab, an activation pumping its controller's creatures
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RAFF_WEATHERLIGHT_STALWART } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
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

const PRINTED = printed(RAFF_WEATHERLIGHT_STALWART, "Whenever you cast an instant or sorcery spell, you may tap two untapped creatures you control. If you do, draw a card.\n{3}{W}{W}: Creatures you control get +1/+1 and gain vigilance until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("You may tap two untapped creatures you control. If you do, draw a card.", RAFF_WEATHERLIGHT_STALWART.name);
const VOCAB_T_L0 = vocabularyTargets("You may tap two untapped creatures you control. If you do, draw a card.");

export const RAFF_WEATHERLIGHT_STALWART_SCRIPT: CardScript = {
  oracleId: RAFF_WEATHERLIGHT_STALWART.oracleId,
  name: RAFF_WEATHERLIGHT_STALWART.name,
  activated: [
    {
      ref: `${RAFF_WEATHERLIGHT_STALWART.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const out: EventBody[] = [];
        for (const inst of Object.values(ctx.state.cards)) {
          if (inst.zone.kind !== 'battlefield' || inst.controller !== obj.controller) continue;
          if (!ctx.derive(inst.id).typeLine.types.includes('Creature')) continue;
          out.push({ t: 'PtModifiedUntilEndOfTurn', card: inst.id, power: 1, toughness: 1, keywords: ["vigilance"] });
        }
        return out;
      },
    },
  ],
  triggers: [
    {
      abilityId: 'castInstantSorcery-0',
      text: LINES[0] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.card !== null && ctx.derive(ev.obj.card).typeLine.types.some((t) => t === 'Instant' || t === 'Sorcery'),
      label: () => "Raff, Weatherlight Stalwart - You may tap two untapped creatures you control. If you do, draw a card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
