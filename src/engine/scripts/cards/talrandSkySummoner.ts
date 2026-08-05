// `Talrand, Sky Summoner` — "Whenever you cast an instant or sorcery spell,
// create a 2/2 blue Drake creature token with flying." The first CAST-watching
// trigger and the first SCRIPT-created token (M6.4c, D160). A default harness
// commander since M3 finally runs.

import { TALRAND_SKY_SUMMONER } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
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
  TALRAND_SKY_SUMMONER,
  'Whenever you cast an instant or sorcery spell, create a 2/2 blue Drake creature token with flying.',
);

/**
 * ⚠️ THE TOKEN COMES FROM `TOKEN_TABLE`, THE ONE RESOLVER (D132/D133) — a
 * printing id hand-copied here would be a second answer to "which Drake", and
 * the guard throws at import if the table ever loses the entry. The printing
 * must also be an `ENGINE_CARDS` fixture and in the game's pool, or the token
 * derives to a blank (D133's trap; `DRAKE_TOKEN` is pinned in
 * `make-engine-fixtures.cjs`).
 */
function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const DRAKE = tokenRef('Drake|2/2|U|Creature|flying');

export const TALRAND_SKY_SUMMONER_SCRIPT: CardScript = {
  oracleId: TALRAND_SKY_SUMMONER.oracleId,
  name: TALRAND_SKY_SUMMONER.name,
  triggers: [
    {
      abilityId: 'cast',
      text: TEXT,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      // "you cast" — the SPELL's controller, not the active player; and the
      // TYPE comes from the face actually cast (a modal DFC casts as one face,
      // D155), asked of the oracle rather than the printed front.
      matches: (ctx, self, ev) => {
        if (ev.t !== 'SpellCast') return false;
        if (ev.obj.controller !== ctx.query.controllerOf(self)) return false;
        if (!ev.obj.card) return false;
        const inst = ctx.state.cards[ev.obj.card];
        const oc = inst ? ctx.oracle.byPrinting(inst.printingId) : undefined;
        if (!oc) return false;
        const types = faceOf(oc, ev.obj.faceIndex).typeLine.types;
        return types.includes('Instant') || types.includes('Sorcery');
      },
      label: () => 'Talrand, Sky Summoner — create a 2/2 Drake with flying',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: DRAKE.oracleId,
          printingId: DRAKE.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
