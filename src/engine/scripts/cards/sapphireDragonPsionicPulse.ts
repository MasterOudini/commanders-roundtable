// `Sapphire Dragon // Psionic Pulse` - a attacks trigger scry, a blocks trigger scry
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SAPPHIRE_DRAGON_PSIONIC_PULSE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SAPPHIRE_DRAGON_PSIONIC_PULSE, "Flying\nWhenever this creature attacks or blocks, scry 2.\nCounter target noncreature spell. (Then exile this card. You may cast the creature later from exile.)");
const LINES = PRINTED.split('\n');

export const SAPPHIRE_DRAGON_PSIONIC_PULSE_SCRIPT: CardScript = {
  oracleId: SAPPHIRE_DRAGON_PSIONIC_PULSE.oracleId,
  name: SAPPHIRE_DRAGON_PSIONIC_PULSE.name,
  triggers: [
    {
      abilityId: 'attacks-1', face: 0,
      text: LINES[1] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Sapphire Dragon // Psionic Pulse - scry",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const n = Math.min(2, library.length);
        if (n === 0) return [];
        const top = library.slice(library.length - n);
        return [
          { t: 'CardsRevealed', cards: top, to: [obj.controller] },
          { t: 'AwaitingSet', awaiting: { kind: 'scryChoice', player: obj.controller, count: n, toGraveyard: false, thenDraw: 0, label: "Sapphire Dragon // Psionic Pulse - scry 2" } },
        ];
      },
    },
    {
      abilityId: 'blocks-1', face: 0,
      text: LINES[1] as string,
      event: 'BlockersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'BlockersDeclared' && ev.blocks.some((b) => b.blocker === self),
      label: () => "Sapphire Dragon // Psionic Pulse - scry",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const n = Math.min(2, library.length);
        if (n === 0) return [];
        const top = library.slice(library.length - n);
        return [
          { t: 'CardsRevealed', cards: top, to: [obj.controller] },
          { t: 'AwaitingSet', awaiting: { kind: 'scryChoice', player: obj.controller, count: n, toGraveyard: false, thenDraw: 0, label: "Sapphire Dragon // Psionic Pulse - scry 2" } },
        ];
      },
    },
  ],
};
