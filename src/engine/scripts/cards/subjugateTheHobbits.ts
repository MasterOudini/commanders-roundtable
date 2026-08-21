// `Subjugate the Hobbits` — mass theft: every creature with mana value 3 or
// less changes hands, EXCEPT commanders (the exclusion read off
// `commanderIds`, Slash the Ranks' precedent). D254.

import { SUBJUGATE_THE_HOBBITS } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(
  SUBJUGATE_THE_HOBBITS,
  'Gain control of each noncommander creature with mana value 3 or less.',
);

export const SUBJUGATE_THE_HOBBITS_SCRIPT: CardScript = {
  oracleId: SUBJUGATE_THE_HOBBITS.oracleId,
  name: SUBJUGATE_THE_HOBBITS.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const commanders = new Set<string>();
      for (const pid of ctx.state.seating) {
        for (const id of ctx.state.players[pid]?.commanderIds ?? []) commanders.add(id);
      }
      const events: EventBody[] = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller === obj.controller) continue;
        if (commanders.has(id)) continue;
        if (!ctx.derive(id).typeLine.types.includes('Creature')) continue;
        const oc = ctx.oracle.byPrinting(card.printingId);
        if (!oc || oc.manaValue > 3) continue;
        events.push({ t: 'ControlChanged', card: id, controller: obj.controller });
      }
      return events;
    },
  },
};
