// D574 - THE ROLE TOKENS (CR 303.7): each Role the vocabulary creates, resolved to the ONE token printing and FACE it names.
//
// The card database holds the Roles only as DOUBLE-FACED token printings (layout `flip`, both faces
// `Token Enchantment — Aura Role`): `Monster // Sorcerer`, `Wicked // Cursed`, `Monster // Virtuous`. A created Role is
// one face of one of them - `TokenCreated` carries the face. A hand table (the generated TOKEN_TABLE reads only
// `layout: 'token'` descriptions), pinned against the fixtures by roleTable.node.test.ts.
//
// D575 - ROYAL AND YOUNG HERO share `Royal // Young Hero` (a shipped script owes EVERY face - engineCompleteness reads
// them all): they joined once the derived ward carried Royal's `has ward {1}`. A Role clause naming a Role absent here is
// a sentence the parser does not read (D90).
import type { TokenRef } from './tokenTable';

export interface RoleRef extends TokenRef {
  /** The face of the double-faced token printing this Role is. */
  readonly faceIndex: number;
}

export const ROLE_TABLE: Readonly<Record<string, RoleRef>> = {
  Monster: { oracleId: 'ed95e696-3e4d-4b2b-9327-46fc2604652c', printingId: '6b8a810b-8538-41c3-a792-dbd1a1845faa', name: 'Monster Role', faceIndex: 0 },
  Sorcerer: { oracleId: 'ed95e696-3e4d-4b2b-9327-46fc2604652c', printingId: '6b8a810b-8538-41c3-a792-dbd1a1845faa', name: 'Sorcerer Role', faceIndex: 1 },
  Wicked: { oracleId: '0664dcc8-fa68-4802-936f-ecd2979ebf3c', printingId: '6929750f-cf08-4e3e-83b0-076e1f6fa8e0', name: 'Wicked Role', faceIndex: 0 },
  Cursed: { oracleId: '0664dcc8-fa68-4802-936f-ecd2979ebf3c', printingId: '6929750f-cf08-4e3e-83b0-076e1f6fa8e0', name: 'Cursed Role', faceIndex: 1 },
  Virtuous: { oracleId: '0873438f-14c4-4427-b42e-9f531ce86e7d', printingId: '27927100-2587-4e05-9957-eb183d46c1f0', name: 'Virtuous Role', faceIndex: 1 },
  Royal: { oracleId: '48b92b4d-ba82-4ea4-a48b-3d2813350260', printingId: 'cff8ef48-2988-4d21-837e-01f1459e07c5', name: 'Royal Role', faceIndex: 0 },
  'Young Hero': { oracleId: '48b92b4d-ba82-4ea4-a48b-3d2813350260', printingId: 'cff8ef48-2988-4d21-837e-01f1459e07c5', name: 'Young Hero Role', faceIndex: 1 },
};

/** The Role a clause names (`Monster`, `monster`), or undefined for a Role the table does not hold. */
export function roleRef(name: string): RoleRef | undefined {
  const key = Object.keys(ROLE_TABLE).find((k) => k.toLowerCase() === name.toLowerCase());
  return key === undefined ? undefined : ROLE_TABLE[key];
}

/** The printings the table names - the pool loader and the fuzz read them. */
export const ROLE_PRINTINGS: ReadonlySet<string> = new Set(Object.values(ROLE_TABLE).map((r) => r.printingId));
