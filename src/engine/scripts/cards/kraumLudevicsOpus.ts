// `Kraum, Ludevic's Opus` - a opponentCastsSpell trigger draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KRAUM_LUDEVIC_S_OPUS } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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

const PRINTED = printed(KRAUM_LUDEVIC_S_OPUS, "Flying, haste\nWhenever an opponent casts their second spell each turn, draw a card.\nPartner (You can have two commanders if both have partner.)");
const LINES = PRINTED.split('\n');

export const KRAUM_LUDEVICS_OPUS_SCRIPT: CardScript = {
  oracleId: KRAUM_LUDEVIC_S_OPUS.oracleId,
  name: KRAUM_LUDEVIC_S_OPUS.name,
  triggers: [
    {
      abilityId: 'opponentCastsSpell-1',
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.controller !== ctx.query.controllerOf(self) && (ctx.state.turn.spellsCast[ev.obj.controller] ?? 0) === 2,
      label: () => "Kraum, Ludevic's Opus - draw",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
