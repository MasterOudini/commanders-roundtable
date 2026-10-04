// `Frolicking Familiar // Blow Off Steam` - a castInstantSorcery trigger pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FROLICKING_FAMILIAR_BLOW_OFF_STEAM } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

function printed(card: CardData, expected: string): string {
  const actual = card.faces.map((f) => f.oracleText ?? '').join('\n');
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(FROLICKING_FAMILIAR_BLOW_OFF_STEAM, "Flying\nWhenever you cast an instant or sorcery spell, this creature gets +1/+1 until end of turn.\nBlow Off Steam deals 1 damage to any target. (Then exile this card. You may cast the creature later from exile.)");
const LINES = PRINTED.split('\n');

export const FROLICKING_FAMILIAR_BLOW_OFF_STEAM_SCRIPT: CardScript = {
  oracleId: FROLICKING_FAMILIAR_BLOW_OFF_STEAM.oracleId,
  name: FROLICKING_FAMILIAR_BLOW_OFF_STEAM.name,
  triggers: [
    {
      abilityId: 'castInstantSorcery-1', face: 0,
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.card !== null && ctx.derive(ev.obj.card).typeLine.types.some((t) => t === 'Instant' || t === 'Sorcery'),
      label: () => "Frolicking Familiar // Blow Off Steam - it pumped until end of turn",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 1 }];
      },
    },
  ],
};
