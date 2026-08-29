import { CommerceDomainError } from "./errors.js";
import { addMoney, money, multiplyMoney, subtractMoney, type Money } from "./money.js";

export type BasketLineInput = Readonly<{
  productId: string;
  sku: string;
  quantity: number;
  unitPrice: Money;
  unitTax: Money;
  unitWeightGrams: number;
}>;

export type BasketLine = BasketLineInput & Readonly<{
  merchandiseTotal: Money;
  taxTotal: Money;
  lineTotal: Money;
  totalWeightGrams: number;
}>;

export type Basket = Readonly<{
  lines: readonly BasketLine[];
  subtotal: Money;
  discount: Money;
  tax: Money;
  delivery: Money;
  total: Money;
  totalWeightGrams: number;
}>;

export const calculateBasket = (
  inputLines: readonly BasketLineInput[],
  discount: Money,
  delivery: Money,
): Basket => {
  if (inputLines.length === 0) {
    throw new CommerceDomainError("empty_basket", "A basket must contain at least one line.");
  }

  const code = inputLines[0]?.unitPrice.currency;
  if (!code) throw new CommerceDomainError("empty_basket", "A basket must contain at least one line.");
  let subtotal = money(0, code);
  let tax = money(0, code);
  let totalWeightGrams = 0;

  const lines = inputLines.map((line): BasketLine => {
    if (!Number.isSafeInteger(line.unitWeightGrams) || line.unitWeightGrams <= 0) {
      throw new CommerceDomainError("invalid_weight", "Unit weight must be a positive integer in grams.");
    }
    const merchandiseTotal = multiplyMoney(line.unitPrice, line.quantity);
    const taxTotal = multiplyMoney(line.unitTax, line.quantity);
    const lineTotal = addMoney(merchandiseTotal, taxTotal);
    const lineWeight = line.unitWeightGrams * line.quantity;
    if (!Number.isSafeInteger(lineWeight)) {
      throw new CommerceDomainError("invalid_weight", "Calculated line weight exceeds the safe integer range.");
    }
    subtotal = addMoney(subtotal, merchandiseTotal);
    tax = addMoney(tax, taxTotal);
    totalWeightGrams += lineWeight;
    if (!Number.isSafeInteger(totalWeightGrams)) {
      throw new CommerceDomainError("invalid_weight", "Basket weight exceeds the safe integer range.");
    }
    return Object.freeze({ ...line, merchandiseTotal, taxTotal, lineTotal, totalWeightGrams: lineWeight });
  });

  const discountedSubtotal = subtractMoney(subtotal, discount);
  const total = addMoney(addMoney(discountedSubtotal, tax), delivery);
  return Object.freeze({ lines, subtotal, discount, tax, delivery, total, totalWeightGrams });
};
