/**
 * offrampService.ts — WLD → KES off-ramp service
 *
 * This service acts as a thin wrapper around the BitnobService.
 * All Bitnob-specific logic has been moved to bitnobService.ts for better
 * maintainability and separation of concerns.
 *
 * @see bitnobService.ts for the full Bitnob API implementation
 */
import { bitnobService, BitnobService } from './bitnobService';
import type { IOfframpService } from '../types';
export declare function createOfframpService(): IOfframpService;
export declare const offrampService: IOfframpService;
export { bitnobService, BitnobService };
//# sourceMappingURL=offrampService.d.ts.map