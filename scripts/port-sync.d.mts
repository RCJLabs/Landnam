// Types for the sync script, so `test/contract.test.ts` can import its
// helpers rather than re-implementing the hashing and drifting from it —
// which is the exact failure the contract bar exists to catch.
export declare const CONTRACT: { from: string; to: string }[];
export declare const MANIFEST: string;
export declare function hashOf(path: string): string;
export declare function currentHashes(): Record<string, string>;
