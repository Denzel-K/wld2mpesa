/**
 * config.ts — Application configuration
 *
 * This project is designed to run against live Worldcoin and payment APIs.
 * Run locally with real app settings (World App App ID + Action ID) and
 * real backend credentials.
 */
import 'dotenv/config';
export declare const config: {
    readonly PORT: number;
    readonly NODE_ENV: string;
    readonly IS_PRODUCTION: boolean;
    readonly WORLD_CHAIN_RPC_URL: string;
    readonly BACKEND_WALLET_ADDRESS: string;
    readonly WLD_APP_ID: string;
    readonly WLD_RP_ID: string;
    readonly WLD_SIGNING_KEY: string;
    readonly WLD_LOGIN_ACTION_ID: string;
    readonly WLD_PAY_ACTION_ID: string;
    readonly BITNOB_API_KEY: string;
    readonly BITNOB_CLIENT_ID: string;
    readonly BITNOB_SECRET_KEY: string;
    readonly BITNOB_ENV: string;
    readonly UNISWAP_V3_ROUTER: "0x8ac7bee993bb44dab564ea4bc9ea67bf9eb5e743";
    readonly WLD_TOKEN: "0x2cFc85d8E48F8EAB294be644d9E25C3030863003";
    readonly USDC_TOKEN: "0x79A02482A8849733928120FE3c23eA97B068D2e3";
    readonly ADMIN_PRIVATE_KEY: string;
    readonly MPESA_CONSUMER_KEY: string;
    readonly MPESA_CONSUMER_SECRET: string;
    readonly MPESA_ENV: string;
    readonly MPESA_SHORTCODE: string;
    readonly MPESA_B2B_SHORTCODE: string;
    readonly MPESA_INITIATOR_NAME: string;
    readonly MPESA_PASSKEY: string;
    readonly BACKEND_URL: string;
    readonly TRANSACTION_LOG_PATH: string;
    readonly FEE_PERCENT: number;
    readonly FEE_TIER_1_PERCENT: number;
    readonly FEE_TIER_2_PERCENT: number;
    readonly FEE_TIER_3_PERCENT: number;
    readonly FEE_TIER_4_PERCENT: number;
    readonly SERVICE_FIXED_FEE_KES: number;
    readonly FEE_TIER_1_MAX: number;
    readonly FEE_TIER_2_MAX: number;
    readonly FEE_TIER_3_MAX: number;
    readonly GAS_BUFFER_KES: number;
    readonly OFFRAMP_RESERVE_PERCENT: number;
    readonly DEX_POOL_FEE_PERCENT: number;
    readonly MINIMUM_MARGIN_KES: number;
    readonly MARGIN_TIER_1_PERCENT: number;
    readonly MARGIN_TIER_2_PERCENT: number;
    readonly MARGIN_TIER_3_PERCENT: number;
    readonly MARGIN_TIER_4_PERCENT: number;
    readonly MPESA_TILL_RESERVE_PERCENT: number;
    readonly MPESA_PAYBILL_RESERVE_PERCENT: number;
    readonly MPESA_MERCHANT_RESERVE_CAP_KES: number;
    readonly MIN_KES_AMOUNT: number;
    readonly MAX_KES_AMOUNT: number;
    readonly WLD_CONTRACT_ADDRESS: "0x2cFc85d8E48F8EAB294be644d9E25C3030863003";
    readonly getFeeForAmount: (kesAmount: number) => number;
    readonly REDIS_URL: string;
    readonly DATABASE_URL: string;
    readonly CLOUDFLARE_ENABLED: boolean;
    readonly EMAIL_HOST: string;
    readonly EMAIL_PORT: number;
    readonly EMAIL_SECURE: boolean;
    readonly EMAIL_USER: string;
    readonly EMAIL_PASSWORD: string;
    readonly EMAIL_FROM_NAME: string;
    readonly EMAIL_FROM_ADDRESS: string;
    readonly JWT_SECRET: string;
    readonly JWT_EXPIRES_IN: string;
    readonly ADMIN_SESSION_TIMEOUT: number;
    readonly INVITATION_EXPIRY_HOURS: number;
};
//# sourceMappingURL=config.d.ts.map