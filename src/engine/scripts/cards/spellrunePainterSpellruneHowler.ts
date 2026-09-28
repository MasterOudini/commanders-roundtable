// `Spellrune Painter // Spellrune Howler` - a castInstantSorcery trigger pumping itself, a castInstantSorcery trigger pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SPELLRUNE_PAINTER_SPELLRUNE_HOWLER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SPELLRUNE_PAINTER_SPELLRUNE_HOWLER, "Whenever you cast an instant or sorcery spell, this creature gets +1/+1 until end of turn.\nDaybound (If a player casts no spells during their own turn, it becomes night next turn.)\nWhenever you cast an instant or sorcery spell, this creature gets +2/+2 until end of turn.\nNightbound (If a player casts at least two spells during their own turn, it becomes day next turn.)");
const LINES = PRINTED.split('\n');

export const SPELLRUNE_PAINTER_SPELLRUNE_HOWLER_SCRIPT: CardScript = {
  oracleId: SPELLRUNE_PAINTER_SPELLRUNE_HOWLER.oracleId,
  name: SPELLRUNE_PAINTER_SPELLRUNE_HOWLER.name,
  triggers: [
    {
      abilityId: 'castInstantSorcery-0', face: 0,
      text: LINES[0] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.card !== null && ctx.derive(ev.obj.card).typeLine.types.some((t) => t === 'Instant' || t === 'Sorcery'),
      label: () => "Spellrune Painter // Spellrune Howler - it pumped until end of turn",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 1 }];
      },
    },
    {
      abilityId: 'castInstantSorcery-2', face: 1,
      text: LINES[2] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.card !== null && ctx.derive(ev.obj.card).typeLine.types.some((t) => t === 'Instant' || t === 'Sorcery'),
      label: () => "Spellrune Painter // Spellrune Howler - it pumped until end of turn",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 2, toughness: 2 }];
      },
    },
  ],
};
