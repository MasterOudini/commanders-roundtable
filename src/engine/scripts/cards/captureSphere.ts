// `Capture Sphere` - a etb trigger tapAttached, a static attachedNoUntap
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CAPTURE_SPHERE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CAPTURE_SPHERE, "Flash (You may cast this spell any time you could cast an instant.)\nEnchant creature\nWhen this Aura enters, tap enchanted creature.\nEnchanted creature doesn't untap during its controller's untap step.");
const LINES = PRINTED.split('\n');

export const CAPTURE_SPHERE_SCRIPT: CardScript = {
  oracleId: CAPTURE_SPHERE.oracleId,
  name: CAPTURE_SPHERE.name,
  triggers: [
    {
      abilityId: 'etb-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Capture Sphere - tapAttached",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const host = ctx.state.cards[self]?.attachedTo ?? null;
        if (host === null) return [];
        const card = ctx.state.cards[host];
        if (!card || card.zone.kind !== 'battlefield' || card.tapped) return [];
        return [{ t: 'PermanentsTapped', cards: [host] }];
      },
    },
  ],
  replacements: [
    {
      abilityId: 'no-untap-3',
      text: LINES[3] as string,
      activeZones: ['battlefield'],
      // CR 614.1 - the untap step's untap is replaced for this one permanent (D323).
      applies: (ctx, self, ev) => {
        const host = ctx.state.cards[self]?.attachedTo ?? null;
        return host !== null && ev.t === 'PermanentsUntapped' && ctx.state.turn.step === 'untap' && ctx.state.turn.activePlayer === ctx.state.cards[host]?.controller && ev.cards.includes(host);
      },
      replace: (ctx, self, ev): readonly EventBody[] => {
        const host = ctx.state.cards[self]?.attachedTo ?? null;
        if (ev.t !== 'PermanentsUntapped' || host === null) return [ev];
        const cards = ev.cards.filter((c) => c !== host);
        return cards.length ? [{ t: 'PermanentsUntapped', cards }] : [];
      },
    },
  ],
};
