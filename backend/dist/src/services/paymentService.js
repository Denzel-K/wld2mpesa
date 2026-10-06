"use strict";
/**
 * paymentService.ts — CORE: Payment orchestration
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentService = void 0;
exports.createPaymentService = createPaymentService;
const uuid_1 = require("uuid");
const config_1 = require("../config");
const rateService_1 = require("./rateService");
const transactionStore_1 = require("./transactionStore");
const worldChainListener_1 = require("./worldChainListener");
const offrampService_1 = require("./offrampService");
const logger_1 = require("../utils/logger");
const pricingService_1 = require("./pricingService");
class PaymentService {
    /**
     * Processes payment through the full pipeline:
     * 1. Verify WLD on-chain
     * 2. DEX swap (WLD → USDC)
     * 3. Off-ramp via Bitnob
     * 4. Wait for M-Pesa disbursement
     */
    async processPaymentPipeline(transactionId) {
        const tx = await transactionStore_1.transactionStore.get(transactionId);
        if (!tx || !tx.txHash)
            return;
        const log = (step, msg) => logger_1.logger.pipelineStep(transactionId, step, 4, msg);
        // Statuses considered already past blockchain confirmation
        const PAST_CONFIRMATION = ['CONFIRMED', 'SWAP_COMPLETED', 'OFFRAMP_INITIATED', 'MPESA_SENT'];
        const isRetry = PAST_CONFIRMATION.includes(tx.status);
        logger_1.logger.pipelineDivider(transactionId, isRetry ? 'RETRY' : 'START');
        logger_1.logger.auditEvent(transactionId, isRetry ? 'PIPELINE_RETRY_STARTED' : 'PIPELINE_STARTED', 'INITIATION', {
            mode: 'PRODUCTION',
            currentStatus: tx.status,
            wldAmount: tx.wldAmount,
            kesAmount: (0, logger_1.formatAmount)(tx.kesAmount),
        });
        const PAST_SWAP = ['SWAP_COMPLETED', 'OFFRAMP_INITIATED', 'MPESA_SENT'];
        const PAST_OFFRAMP = ['MPESA_SENT'];
        try {
            // Step 1: Verify WLD on-chain (skip if already confirmed)
            if (PAST_CONFIRMATION.includes(tx.status)) {
                log(1, `↩ Skipping blockchain confirmation — status already: ${tx.status}`);
            }
            else {
                log(1, 'Verifying WLD transfer on World Chain...');
                const amountBigInt = BigInt(Math.floor(parseFloat(tx.wldAmount) * 1e18));
                const confirmed = await worldChainListener_1.worldChainListener.waitForWldTransfer(tx.payToAddress, amountBigInt, tx.txHash);
                if (!confirmed) {
                    logger_1.logger.userError(transactionId, 'BLOCKCHAIN_CONFIRM_FAILED', 'Payment could not be verified on the blockchain', 'On-chain WLD transfer could not be verified');
                    throw new Error('On-chain WLD transfer could not be verified');
                }
                await transactionStore_1.transactionStore.update(transactionId, { status: 'CONFIRMED' });
                log(1, '✓ WLD confirmed on World Chain');
            }
            // Step 2: Local Liquidity Rebalancing (skip if already done)
            let swapHash = null;
            if (PAST_SWAP.includes(tx.status)) {
                log(2, `↩ Skipping DEX swap — status already: ${tx.status}`);
            }
            else {
                log(2, 'Rebalancing liquidity (WLD → USDC)...');
                try {
                    const { swapService } = await Promise.resolve().then(() => __importStar(require('./swapService')));
                    swapHash = await swapService.swapWldForUsdc(tx.wldAmount);
                    logger_1.logger.dexOperation(transactionId, 'Swap completed', tx.wldAmount, 'WLD', swapHash);
                    log(2, `✓ Rebalanced: ${swapHash.slice(0, 10)}...${swapHash.slice(-6)}`);
                    // Record swap completion so a retry can skip this step
                    await transactionStore_1.transactionStore.update(transactionId, { status: 'SWAP_COMPLETED' });
                }
                catch (swapErr) {
                    const errorMsg = swapErr instanceof Error ? swapErr.message : 'Unknown error';
                    // Do not pay out from untracked prefunded liquidity after a failed swap.
                    // The failure path marks the transaction failed and starts the auditable refund flow.
                    logger_1.logger.error('DEX', 'Rebalancing failed — payout blocked and refund required', transactionId, { error: errorMsg });
                    throw new Error(`DEX rebalancing failed; payout blocked: ${errorMsg}`);
                }
            }
            // Step 3: Off-ramp / Payout via Bitnob (all transaction types)
            // All four types — send, pochi, till, paybill — are now routed through
            // the Bitnob 3-step Payouts API with the correct Kenya corridor beneficiary.
            let payoutId = tx.offrampId ?? '';
            if (PAST_OFFRAMP.includes(tx.status) && tx.offrampId) {
                log(3, `↩ Skipping off-ramp initiation — already initiated: ${tx.offrampId.slice(0, 8)}...`);
                payoutId = tx.offrampId;
            }
            else {
                log(3, `Initiating ${(0, logger_1.formatTransactionType)(tx.transactionType)} via Bitnob (Quote → Initialize → Finalize)...`);
                const payout = await offrampService_1.offrampService.initiateSwap(tx.wldAmount, tx.kesAmount, transactionId);
                payoutId = payout.swapId;
                await transactionStore_1.transactionStore.update(transactionId, {
                    status: 'OFFRAMP_INITIATED',
                    offrampId: payoutId,
                    offrampAt: new Date().toISOString(),
                });
                log(3, `✓ Bitnob payout finalized [${payoutId.slice(0, 8)}...]`);
            }
            // Step 4: Finalize
            // Note: Bitnob handles the actual disbursement. We wait for their callback
            // or poll to mark it as SETTLED.
            log(4, 'Waiting for payout provider to complete disbursement...');
            const payoutStatus = await this.pollUntil(() => offrampService_1.offrampService.checkSwapStatus(payoutId, transactionId), (s) => s === 'COMPLETED' || s === 'FAILED', 180000, // 3 min timeout
            10000 // 10s interval
            );
            if (payoutStatus !== 'COMPLETED') {
                logger_1.logger.userError(transactionId, 'PAYOUT_FAILED', 'MPESA disbursement failed - your WLD will be refunded', 'Payout failed or timed out');
                throw new Error('Payout failed or timed out');
            }
            await transactionStore_1.transactionStore.update(transactionId, {
                status: 'SETTLED',
                settledAt: new Date().toISOString(),
            });
            log(4, '✓ SETTLED - Funds sent to recipient');
            logger_1.logger.pipelineDivider(transactionId, 'END');
            logger_1.logger.info('PAYMENT', 'Transaction completed successfully', transactionId, {
                kesAmount: (0, logger_1.formatAmount)(tx.kesAmount),
                swapHash: swapHash ? `${swapHash.slice(0, 10)}...${swapHash.slice(-6)}` : 'skipped',
                destination: (() => {
                    switch (tx.transactionType) {
                        case 'send': return (0, logger_1.maskPhoneNumber)(tx.phoneNumber ?? '');
                        case 'pochi': return `Pochi ${(0, logger_1.maskPhoneNumber)(tx.phoneNumber ?? '')}`;
                        case 'paybill': return `Paybill ${tx.tillNumber} / Acct ${tx.accountNumber?.slice(0, 3)}...`;
                        case 'till': return `Till ${tx.tillNumber}`;
                        default: return tx.transactionType;
                    }
                })(),
            });
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown production pipeline error';
            logger_1.logger.error('PAYMENT', `Pipeline critical failure: ${msg}`, transactionId, err);
            logger_1.logger.auditEvent(transactionId, 'PIPELINE_FAILED', 'FAILURE', { reason: msg, mode: 'PRODUCTION' });
            logger_1.logger.pipelineDivider(transactionId, 'END');
            await this.markFailed(transactionId, msg);
        }
    }
    async initiatePayment(params) {
        const { transactionType, kesAmount, tillNumber, phoneNumber, accountNumber, walletAddress } = params;
        if (kesAmount < config_1.config.MIN_KES_AMOUNT || kesAmount > config_1.config.MAX_KES_AMOUNT) {
            throw new Error(`Amount must be between KES ${config_1.config.MIN_KES_AMOUNT} and KES ${config_1.config.MAX_KES_AMOUNT}`);
        }
        if (transactionType === 'paybill') {
            if (!tillNumber || !/^\d{5,7}$/.test(tillNumber))
                throw new Error('Invalid Paybill number');
            if (!accountNumber)
                throw new Error('Account number is required');
        }
        else if (transactionType === 'send' || transactionType === 'pochi') {
            if (!phoneNumber || !/^(\+254|0)[17]\d{8}$/.test(phoneNumber))
                throw new Error('Invalid M-Pesa phone number');
        }
        else {
            if (!tillNumber || !/^\d{5,6}$/.test(tillNumber))
                throw new Error('Invalid Till number — must be 5 or 6 digits');
        }
        const rate = await rateService_1.rateService.getWldKesRate();
        const quote = (0, pricingService_1.quotePayment)(kesAmount, transactionType, rate.wldPriceKes);
        const { wldAmount, feeWld } = quote;
        const feeKes = quote.totalUserFeeKes;
        const platformFee = quote.userServiceFeeKes;
        const safaricomFee = quote.userRailFeeKes;
        const gasBuffer = quote.platformCosts.gasReserveKes;
        const bitnobFeeKes = quote.platformCosts.offrampReserveKes;
        const dexFeeKes = quote.platformCosts.dexReserveKes;
        const netPlatformRevenueKes = quote.expectedNetMarginKes;
        const tx = {
            id: `TXN-${Date.now()}-${(0, uuid_1.v4)().slice(0, 4).toUpperCase()}`,
            status: 'INITIATED',
            transactionType,
            kesAmount,
            tillNumber,
            phoneNumber,
            accountNumber,
            walletAddress,
            wldAmount,
            feeWld,
            feeKes,
            wldRate: rate.wldPriceKes.toString(),
            payToAddress: config_1.config.BACKEND_WALLET_ADDRESS,
            createdAt: new Date().toISOString(),
            platformFeeKes: platformFee,
            safaricomFeeKes: safaricomFee,
            gasBufferKes: gasBuffer,
            bitnobFeeKes,
            dexFeeKes,
            netPlatformRevenueKes,
        };
        await transactionStore_1.transactionStore.save(tx);
        const recipient = transactionType === 'send' || transactionType === 'pochi'
            ? (0, logger_1.maskPhoneNumber)(phoneNumber)
            : transactionType === 'paybill'
                ? `Paybill ${tillNumber} (Acct: ${accountNumber?.slice(0, 3)}...)`
                : `Till ${tillNumber}`;
        logger_1.logger.paymentInitiated(tx.id, transactionType, kesAmount, recipient);
        logger_1.logger.info('PAYMENT', `Rate: 1 WLD = ${(0, logger_1.formatAmount)(rate.wldPriceKes)} | Total fee: KSh ${(0, logger_1.formatAmount)(feeKes)}`, tx.id, {
            wldAmount: `${wldAmount} WLD`,
            payToAddress: (0, logger_1.maskWalletAddress)(config_1.config.BACKEND_WALLET_ADDRESS),
            feeBreakdown: {
                platformFee: `KSh ${(0, logger_1.formatAmount)(platformFee)} (service & settlement)`,
                safaricomFee: `KSh ${(0, logger_1.formatAmount)(safaricomFee)} (${transactionType} rail reserve)`,
                gasBuffer: `KSh ${(0, logger_1.formatAmount)(gasBuffer)} (World Chain L2 ETH gas absorption)`,
                totalFeeKes: `KSh ${(0, logger_1.formatAmount)(feeKes)}`,
                totalFeeWld: `${feeWld} WLD`,
            },
            platformCosts: {
                bitnobSpread: `KSh ${(0, logger_1.formatAmount)(bitnobFeeKes)} (${config_1.config.OFFRAMP_RESERVE_PERCENT}% reserve)`,
                dexPoolFee: `KSh ${(0, logger_1.formatAmount)(dexFeeKes)} (${config_1.config.DEX_POOL_FEE_PERCENT}% reserve)`,
                gasBuffer: `KSh ${(0, logger_1.formatAmount)(gasBuffer)}`,
                netRevenue: `KSh ${(0, logger_1.formatAmount)(netPlatformRevenueKes)} (minimum protected margin)`,
            },
        });
        return {
            transactionId: tx.id,
            wldAmount,
            feeWld,
            feeKes,
            rate: rate.wldPriceKes.toString(),
            expiresAt: new Date(Date.now() + 5 * 60000).toISOString(),
            payToAddress: config_1.config.BACKEND_WALLET_ADDRESS,
        };
    }
    async confirmPayment(params) {
        const { transactionId, txHash, miniKitPayload } = params;
        const tx = await transactionStore_1.transactionStore.get(transactionId);
        if (!tx)
            throw new Error(`Transaction not found: ${transactionId}`);
        if (tx.status !== 'INITIATED') {
            throw new Error(`Transaction ${transactionId} is in state ${tx.status} — cannot confirm`);
        }
        await transactionStore_1.transactionStore.update(transactionId, {
            status: 'PENDING_CONFIRMATION',
            txHash,
            miniKitPayload,
            confirmedAt: new Date().toISOString(),
        });
        logger_1.logger.info('PAYMENT', `Payment confirmed on-chain`, transactionId, {
            txHash: txHash ? `${txHash.slice(0, 10)}...${txHash.slice(-6)}` : 'N/A',
        });
        logger_1.logger.pipelineStep(transactionId, 1, 4, '✓ WLD payment confirmed on World Chain');
        void this.processPaymentPipeline(transactionId);
        return {
            transactionId,
            status: 'PENDING_CONFIRMATION',
            estimatedSettlementMinutes: 3,
        };
    }
    async getTransactionStatus(transactionId) {
        const tx = await transactionStore_1.transactionStore.get(transactionId);
        if (!tx)
            throw new Error(`Transaction not found: ${transactionId}`);
        return {
            transactionId: tx.id || tx.transactionId,
            status: tx.status,
            transactionType: tx.transactionType,
            kesAmount: tx.kesAmount,
            tillNumber: tx.tillNumber ?? undefined,
            phoneNumber: tx.phoneNumber ?? undefined,
            accountNumber: tx.accountNumber ?? undefined,
            mpesaReceiptNumber: tx.mpesaReceiptNumber ?? undefined,
            settledAt: tx.settledAt ?? undefined,
            failureReason: tx.failureReason ?? undefined,
            steps: this.buildSteps(tx),
        };
    }
    buildSteps(tx) {
        const steps = [
            {
                step: 'WLD_RECEIVED',
                timestamp: tx.confirmedAt ?? tx.createdAt,
                done: ['CONFIRMED', 'SWAP_COMPLETED', 'OFFRAMP_INITIATED', 'MPESA_SENT', 'SETTLED'].includes(tx.status),
            },
            {
                step: 'DEX_SWAP',
                timestamp: tx.confirmedAt ?? tx.createdAt,
                done: ['SWAP_COMPLETED', 'OFFRAMP_INITIATED', 'MPESA_SENT', 'SETTLED'].includes(tx.status),
            },
            {
                step: 'OFFRAMP_INITIATED',
                timestamp: tx.offrampAt ?? tx.confirmedAt ?? tx.createdAt,
                done: ['OFFRAMP_INITIATED', 'MPESA_SENT', 'SETTLED'].includes(tx.status),
            },
            {
                step: 'MPESA_SENT',
                timestamp: tx.mpesaSentAt ?? tx.offrampAt ?? tx.createdAt,
                done: ['MPESA_SENT', 'SETTLED'].includes(tx.status),
            },
            {
                step: 'SETTLED',
                timestamp: tx.settledAt ?? tx.createdAt,
                done: tx.status === 'SETTLED',
            },
        ];
        return steps;
    }
    async markSettled(transactionId, mpesaReceipt) {
        await transactionStore_1.transactionStore.update(transactionId, {
            status: 'SETTLED',
            mpesaReceiptNumber: mpesaReceipt,
            settledAt: new Date().toISOString(),
        });
        logger_1.logger.info('PAYMENT', `Transaction SETTLED`, transactionId, { mpesaReceipt });
    }
    async markFailed(transactionId, reason) {
        await transactionStore_1.transactionStore.update(transactionId, {
            status: 'FAILED',
            failureReason: reason,
            failedAt: new Date().toISOString(),
        });
        logger_1.logger.userError(transactionId, 'TXN_FAILED', 'Transaction failed - funds will be returned', reason);
    }
    async initiateRefund(transactionId, walletAddress) {
        const tx = await transactionStore_1.transactionStore.get(transactionId);
        if (!tx)
            throw new Error(`Transaction not found: ${transactionId}`);
        if (tx.refundStatus === 'REFUND_INITIATED') {
            logger_1.logger.warn('REFUND', 'Duplicate refund attempt blocked — refund already in-flight', transactionId, {
                wallet: (0, logger_1.maskWalletAddress)(walletAddress),
                currentRefundStatus: tx.refundStatus,
            });
            throw new Error('A refund is already in progress for this transaction. Please wait.');
        }
        if (tx.refundStatus === 'REFUNDED' && tx.refundTxHash) {
            logger_1.logger.warn('REFUND', 'Duplicate refund attempt blocked — already refunded on-chain', transactionId, {
                wallet: (0, logger_1.maskWalletAddress)(walletAddress),
                refundTxHash: tx.refundTxHash.slice(0, 12),
            });
            throw new Error('This transaction has already been refunded on-chain.');
        }
        if (!tx.wldAmount || parseFloat(tx.wldAmount) <= 0) {
            logger_1.logger.error('REFUND', 'Cannot refund — wldAmount is missing or zero', transactionId);
            throw new Error('Cannot process refund: WLD amount is not recorded for this transaction.');
        }
        logger_1.logger.refundInitiated(transactionId, walletAddress, tx.wldAmount, tx.failureReason || 'User-requested conflict resolution');
        logger_1.logger.auditEvent(transactionId, 'REFUND_REQUESTED', 'REFUND', {
            wallet: (0, logger_1.maskWalletAddress)(walletAddress),
            wldAmount: tx.wldAmount,
            kesAmount: (0, logger_1.formatAmount)(tx.kesAmount),
            originalStatus: tx.status,
        });
        await transactionStore_1.transactionStore.update(transactionId, {
            status: 'FAILED',
            failureReason: tx.failureReason || 'Refund requested',
            failedAt: tx.failedAt || new Date().toISOString(),
            refundStatus: 'REFUND_INITIATED',
            refundAt: new Date().toISOString(),
        });
        void this.processRefundPipeline(transactionId, walletAddress, tx.wldAmount);
    }
    async processRefundPipeline(transactionId, walletAddress, wldAmount) {
        logger_1.logger.pipelineDivider(transactionId, 'START');
        logger_1.logger.pipelineStep(transactionId, 0, 1, `Processing refund of ${wldAmount} WLD → ${(0, logger_1.maskWalletAddress)(walletAddress)}`);
        if (!config_1.config.ADMIN_PRIVATE_KEY) {
            const msg = 'ADMIN_PRIVATE_KEY not configured — on-chain refund cannot be executed';
            logger_1.logger.error('REFUND', msg, transactionId);
            await transactionStore_1.transactionStore.update(transactionId, { refundStatus: 'REFUND_FAILED' });
            logger_1.logger.refundFailed(transactionId, walletAddress, wldAmount, msg);
            logger_1.logger.userError(transactionId, 'REFUND_FAILED', 'Automatic refund could not be processed. Please contact support at support@wld2cash.app', msg);
            return;
        }
        try {
            const { ethers } = await Promise.resolve().then(() => __importStar(require('ethers')));
            // Use RPC fallback from worldChainListener for reliability
            const provider = new ethers.JsonRpcProvider(config_1.config.WORLD_CHAIN_RPC_URL);
            const signer = new ethers.Wallet(config_1.config.ADMIN_PRIVATE_KEY, provider);
            // Pre-flight gas check
            const minRequiredEth = ethers.parseEther('0.001'); // Minimum 0.001 ETH for gas
            const walletBalance = await provider.getBalance(signer.address);
            if (walletBalance < minRequiredEth) {
                const msg = `Insufficient ETH for gas. Have: ${ethers.formatEther(walletBalance)} ETH, Need: ${ethers.formatEther(minRequiredEth)} ETH`;
                logger_1.logger.error('REFUND', msg, transactionId);
                await transactionStore_1.transactionStore.update(transactionId, { refundStatus: 'REFUND_FAILED' });
                logger_1.logger.refundFailed(transactionId, walletAddress, wldAmount, msg);
                logger_1.logger.securityEvent('CRITICAL: Refund failed due to insufficient gas', {
                    transactionId,
                    wallet: (0, logger_1.maskWalletAddress)(walletAddress),
                    wldAmount,
                    balance: ethers.formatEther(walletBalance),
                });
                return;
            }
            logger_1.logger.info('REFUND', `Gas check passed. Balance: ${ethers.formatEther(walletBalance)} ETH`, transactionId);
            const erc20Abi = ['function transfer(address to, uint256 amount) public returns (bool)'];
            const wldContract = new ethers.Contract(config_1.config.WLD_CONTRACT_ADDRESS, erc20Abi, signer);
            const amountWei = ethers.parseUnits(wldAmount, 18);
            logger_1.logger.info('REFUND', `Sending ${wldAmount} WLD on-chain to ${(0, logger_1.maskWalletAddress)(walletAddress)}`, transactionId);
            // Attempt refund with retry logic
            let refundTxHash = null;
            const maxRetries = 3;
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    const tx = await wldContract.transfer(walletAddress, amountWei, {
                        gasLimit: 100000, // Set explicit gas limit
                    });
                    logger_1.logger.info('REFUND', `Refund tx broadcast (attempt ${attempt}/${maxRetries}): ${tx.hash.slice(0, 12)}...${tx.hash.slice(-6)}`, transactionId);
                    const receipt = await tx.wait(1);
                    refundTxHash = receipt?.hash ?? tx.hash;
                    break; // Success, exit retry loop
                }
                catch (txErr) {
                    const errMsg = txErr instanceof Error ? txErr.message : 'Unknown error';
                    logger_1.logger.warn('REFUND', `Refund attempt ${attempt}/${maxRetries} failed`, transactionId, { error: errMsg });
                    if (attempt < maxRetries) {
                        const delay = 1000 * Math.pow(2, attempt); // Exponential backoff
                        logger_1.logger.info('REFUND', `Retrying in ${delay}ms...`, transactionId);
                        await new Promise(r => setTimeout(r, delay));
                    }
                    else {
                        throw txErr; // All retries exhausted
                    }
                }
            }
            if (!refundTxHash) {
                throw new Error('Failed to get refund transaction hash after retries');
            }
            await transactionStore_1.transactionStore.update(transactionId, {
                refundStatus: 'REFUNDED',
                refundTxHash,
                refundAt: new Date().toISOString(),
            });
            logger_1.logger.refundCompleted(transactionId, walletAddress, wldAmount, refundTxHash);
            logger_1.logger.auditEvent(transactionId, 'REFUND_COMPLETED', 'REFUND', {
                wallet: (0, logger_1.maskWalletAddress)(walletAddress),
                wldAmount,
                refundTxHash: `${refundTxHash.slice(0, 12)}...${refundTxHash.slice(-6)}`,
            });
            logger_1.logger.pipelineDivider(transactionId, 'END');
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown refund error';
            await transactionStore_1.transactionStore.update(transactionId, { refundStatus: 'REFUND_FAILED' });
            logger_1.logger.refundFailed(transactionId, walletAddress, wldAmount, msg);
            logger_1.logger.userError(transactionId, 'REFUND_FAILED', 'Automatic refund could not be processed. Please contact support at support@wld2cash.app', msg);
            logger_1.logger.securityEvent('ERROR: Refund permanently failed - manual intervention required', {
                transactionId,
                wallet: (0, logger_1.maskWalletAddress)(walletAddress),
                wldAmount,
                error: msg,
            });
            logger_1.logger.pipelineDivider(transactionId, 'END');
        }
    }
    async pollUntil(fn, isDone, timeoutMs, intervalMs) {
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
            const result = await fn();
            if (isDone(result))
                return result;
            await new Promise(r => setTimeout(r, intervalMs));
        }
        return null;
    }
}
function createPaymentService() {
    return new PaymentService();
}
exports.paymentService = createPaymentService();
//# sourceMappingURL=paymentService.js.map