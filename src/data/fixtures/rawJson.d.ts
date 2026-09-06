// D335 - the fixture index imports its records as a string (`engineCards.json?raw`)
// and parses them once: measured at 0.36 s of import against 1.56 s for the
// same file as a JSON module. Vite resolves the `?raw` query at build and test
// time; this declares its type for the node tsconfig, which does not load
// vite/client. (Under the app tsconfig both patterns exist and the longer one,
// this, wins.)
declare module '*.json?raw' {
  const raw: string;
  export default raw;
}
