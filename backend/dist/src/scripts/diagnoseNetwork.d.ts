/**
 * diagnoseNetwork.ts — Diagnostic script to test external API connectivity
 *
 * Run with: npx tsx src/scripts/diagnoseNetwork.ts
 */
declare const APIs: {
    name: string;
    url: string;
    method: string;
    critical: boolean;
}[];
declare function testAPI(api: typeof APIs[0]): Promise<boolean>;
declare function diagnose(): Promise<void>;
//# sourceMappingURL=diagnoseNetwork.d.ts.map