// `Ravaging Blaze` — "Ravaging Blaze deals X damage to target creature.\n
// Spell mastery — If there are two or more instant and/or sorcery cards in
// your graveyard, Ravaging Blaze also deals X damage to that creature's
// controller." Blaze's X read off the stack object (xValue), and an ability
// word (Radiance's rule, D270) whose condition counts instants and
// sorceries in my graveyard by their printed cast face; the controller is
// read BEFORE the damage lands. D279.

import { RAVAGING_BLAZE } from '../../../data/fixtures/engineCards';
import { faceOf } from '../../oracle';
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
  RAVAGING_BLAZE,
  "Ravaging Blaze deals X damage to target creature.\nSpell mastery — If there are two or more instant and/or sorcery cards in your graveyard, Ravaging Blaze also deals X damage to that creature's controller.",
);

export const RAVAGING_BLAZE_SCRIPT: CardScript = {
  oracleId: RAVAGING_BLAZE.oracleId,
  name: RAVAGING_BLAZE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const x = obj.xValue ?? 0;
      if (x <= 0) return [];
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      const controller = card.controller;
      let spells = 0;
      for (const id of ctx.state.zones.graveyard[obj.controller] ?? []) {
        const inst = ctx.state.cards[id];
        const oc = inst ? ctx.oracle.byPrinting(inst.printingId) : undefined;
        if (!oc) continue;
        const types = faceOf(oc, 0).typeLine.types;
        if (types.includes('Instant') || types.includes('Sorcery')) spells += 1;
      }
      const hit = (to: { kind: 'card'; id: string } | { kind: 'player'; id: string }) => ({
        source: self,
        target: to,
        amount: x,
        deathtouch: false,
        lifelinkTo: null,
        isCommanderDamage: false,
        viaTrample: 0,
        toxic: 0,
        applyAs: 'normal' as const,
      });
      const damages = [hit({ kind: 'card', id: target.id })];
      const them = ctx.state.players[controller];
      if (spells >= 2 && them && !them.hasLost) damages.push(hit({ kind: 'player', id: controller }));
      return [{ t: 'DamageDealt', damages }];
    },
  },
};
