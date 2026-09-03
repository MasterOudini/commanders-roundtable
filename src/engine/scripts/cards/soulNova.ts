// `Soul Nova` — exile the attacker and every Equipment attached to it
// (Eaten by Spiders' attachment walk with exile as the destination). D291's
// role.

import { SOUL_NOVA } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(SOUL_NOVA, 'Exile target attacking creature and all Equipment attached to it.');

export const SOUL_NOVA_SCRIPT: CardScript = {
  oracleId: SOUL_NOVA.oracleId,
  name: SOUL_NOVA.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      const moves = [{ card: target.id, from: { kind: 'battlefield' as const, player: card.controller }, to: { kind: 'exile' as const, player: card.owner } }];
      for (const att of card.attachments) {
        const a = ctx.state.cards[att];
        if (!a || a.zone.kind !== 'battlefield') continue;
        if (!ctx.derive(att).typeLine.subtypes.includes('Equipment')) continue;
        moves.push({ card: att, from: { kind: 'battlefield' as const, player: a.controller }, to: { kind: 'exile' as const, player: a.owner } });
      }
      return [{ t: 'CardsMoved', moves }];
    },
  },
};
