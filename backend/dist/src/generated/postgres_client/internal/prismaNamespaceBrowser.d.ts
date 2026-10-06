import * as runtime from "@prisma/client/runtime/index-browser";
export type * from '../models';
export type * from './prismaNamespace';
export declare const Decimal: typeof runtime.Decimal;
export declare const NullTypes: {
    DbNull: (new (secret: never) => typeof runtime.DbNull);
    JsonNull: (new (secret: never) => typeof runtime.JsonNull);
    AnyNull: (new (secret: never) => typeof runtime.AnyNull);
};
/**
 * Helper for filtering JSON entries that have `null` on the database (empty on the db)
 *
 * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
 */
export declare const DbNull: import("@prisma/client-runtime-utils").DbNullClass;
/**
 * Helper for filtering JSON entries that have JSON `null` values (not empty on the db)
 *
 * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
 */
export declare const JsonNull: import("@prisma/client-runtime-utils").JsonNullClass;
/**
 * Helper for filtering JSON entries that are `Prisma.DbNull` or `Prisma.JsonNull`
 *
 * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
 */
export declare const AnyNull: import("@prisma/client-runtime-utils").AnyNullClass;
export declare const ModelName: {
    readonly User: "User";
    readonly Transaction: "Transaction";
    readonly RateCache: "RateCache";
    readonly WebhookEvent: "WebhookEvent";
};
export type ModelName = (typeof ModelName)[keyof typeof ModelName];
export declare const TransactionIsolationLevel: {
    readonly ReadUncommitted: "ReadUncommitted";
    readonly ReadCommitted: "ReadCommitted";
    readonly RepeatableRead: "RepeatableRead";
    readonly Serializable: "Serializable";
};
export type TransactionIsolationLevel = (typeof TransactionIsolationLevel)[keyof typeof TransactionIsolationLevel];
export declare const UserScalarFieldEnum: {
    readonly id: "id";
    readonly walletAddress: "walletAddress";
    readonly nullifierHash: "nullifierHash";
    readonly name: "name";
    readonly verificationLevel: "verificationLevel";
    readonly isVerified: "isVerified";
    readonly onboarded: "onboarded";
    readonly createdAt: "createdAt";
    readonly lastSeenAt: "lastSeenAt";
};
export type UserScalarFieldEnum = (typeof UserScalarFieldEnum)[keyof typeof UserScalarFieldEnum];
export declare const TransactionScalarFieldEnum: {
    readonly id: "id";
    readonly status: "status";
    readonly transactionType: "transactionType";
    readonly kesAmount: "kesAmount";
    readonly wldAmount: "wldAmount";
    readonly feeWld: "feeWld";
    readonly feeKes: "feeKes";
    readonly wldRate: "wldRate";
    readonly tillNumber: "tillNumber";
    readonly phoneNumber: "phoneNumber";
    readonly accountNumber: "accountNumber";
    readonly walletAddress: "walletAddress";
    readonly payToAddress: "payToAddress";
    readonly txHash: "txHash";
    readonly offrampId: "offrampId";
    readonly mpesaConversationId: "mpesaConversationId";
    readonly mpesaReceiptNumber: "mpesaReceiptNumber";
    readonly failureReason: "failureReason";
    readonly miniKitPayload: "miniKitPayload";
    readonly worldIdProof: "worldIdProof";
    readonly createdAt: "createdAt";
    readonly confirmedAt: "confirmedAt";
    readonly offrampAt: "offrampAt";
    readonly mpesaSentAt: "mpesaSentAt";
    readonly settledAt: "settledAt";
    readonly failedAt: "failedAt";
    readonly userId: "userId";
};
export type TransactionScalarFieldEnum = (typeof TransactionScalarFieldEnum)[keyof typeof TransactionScalarFieldEnum];
export declare const RateCacheScalarFieldEnum: {
    readonly id: "id";
    readonly wldPriceKes: "wldPriceKes";
    readonly wldPriceUsd: "wldPriceUsd";
    readonly usdKesRate: "usdKesRate";
    readonly source: "source";
    readonly fetchedAt: "fetchedAt";
};
export type RateCacheScalarFieldEnum = (typeof RateCacheScalarFieldEnum)[keyof typeof RateCacheScalarFieldEnum];
export declare const WebhookEventScalarFieldEnum: {
    readonly id: "id";
    readonly source: "source";
    readonly eventType: "eventType";
    readonly rawPayload: "rawPayload";
    readonly processedAt: "processedAt";
    readonly createdAt: "createdAt";
    readonly transactionId: "transactionId";
};
export type WebhookEventScalarFieldEnum = (typeof WebhookEventScalarFieldEnum)[keyof typeof WebhookEventScalarFieldEnum];
export declare const SortOrder: {
    readonly asc: "asc";
    readonly desc: "desc";
};
export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder];
export declare const QueryMode: {
    readonly default: "default";
    readonly insensitive: "insensitive";
};
export type QueryMode = (typeof QueryMode)[keyof typeof QueryMode];
export declare const NullsOrder: {
    readonly first: "first";
    readonly last: "last";
};
export type NullsOrder = (typeof NullsOrder)[keyof typeof NullsOrder];
//# sourceMappingURL=prismaNamespaceBrowser.d.ts.map