// `Loran, Disciple of History` - "Whenever Loran or another legendary creature you
// control enters, return target artifact card from your graveyard to your hand."
// - once PER legendary creature (per-item, D185), Loran herself included; the
// typed card noun is D298's.

import { LORAN_DISCIPLE_OF_HISTORY } from '../../../data/fixtures/engineCards';
import { parseTargetClauses } from '../../../data/targetParse';
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
  LORAN_DISCIPLE_OF_HISTORY,
  'Whenever Loran or another legendary creature you control enters, return target artifact card from your graveyard to your hand.',
);

export const LORAN_DISCIPLE_OF_HISTORY_SCRIPT: CardScript = {
  oracleId: LORAN_DISCIPLE_OF_HISTORY.oracleId,
  name: LORAN_DISCIPLE_OF_HISTORY.name,
  triggers: [
    {
      abilityId: 'legendary-enters',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(TEXT),
      matches: (_ctx, _self, ev) => ev.t === 'CardsMoved',
      perItem: (ctx, self, ev) => {
        if (ev.t !== 'CardsMoved') return [];
        const me = ctx.query.controllerOf(self);
        return ev.moves
          .filter((m) => {
            if (m.to.kind !== 'battlefield' || m.from.kind === 'battlefield') return false;
            if (m.card === self) return true;
            const c = ctx.state.cards[m.card];
            if (!c || c.controller !== me) return false;
            const d = ctx.derive(m.card);
            return d.typeLine.types.includes('Creature') && d.typeLine.supertypes.includes('Legendary');
          })
          .map((m) => m.card);
      },
      label: () => 'Loran, Disciple of History - return an artifact card to your hand',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'graveyard') return [];
        return [{ t: 'CardsMoved', moves: [{ card: target.id, from: { kind: 'graveyard', player: card.owner }, to: { kind: 'hand', player: card.owner } }] }];
      },
    },
  ],
};
