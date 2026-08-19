export type PublicationState = "tbc" | "verified" | "approved_for_publication";
export interface ProductFact { key: string; value?: string; state: PublicationState; evidence?: string; }
export const productFacts: ProductFact[] = [];
export const publicProductFacts = (facts: ProductFact[]) => facts.filter(({ state }) => state === "approved_for_publication");
