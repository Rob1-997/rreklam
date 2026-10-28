export const MIN_MARGIN_BPS: number;
export const REQUIRED_MANUAL_CATEGORIES: readonly string[];
export type QuoteCostCategory = "PRINT"|"INSTALL"|"REMOVAL"|"LOGISTICS"|"OPERATIONS"|"PAYMENT_FEE"|"RESERVE"|"OTHER";
export type QuoteLineInput = { quantity:number; unitPriceAmd:number; unitDriverRateAmd:number };
export type QuoteCostInput = { category: QuoteCostCategory; amountAmd:number };
export interface QuoteResult {
  grossPriceAmd:number;discountAmd:number;priceAmd:number;driverPayoutAmd:number;manualCostAmd:number;directCostAmd:number;profitAmd:number;marginBps:number;belowMinimum:boolean;requiresOwnerApproval:boolean;
  lines:(QuoteLineInput & {totalPriceAmd:number;totalDriverPayoutAmd:number})[];
  costs:QuoteCostInput[];
}
export function evaluateCampaignQuote(options:{lines:QuoteLineInput[];costs:QuoteCostInput[];discountAmd?:number;minimumMarginBps?:number}):QuoteResult;
