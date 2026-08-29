import { CommerceDomainError } from "./errors.js";

export type Currency = string & { readonly __currencyBrand: unique symbol };

export type Money = Readonly<{
  currency: Currency;
  value: number;
}>;

export const currency = (value: string): Currency => {
  if (!/^[A-Z]{3}$/.test(value)) {
    throw new CommerceDomainError("invalid_currency", "Currency must be a three-letter uppercase ISO code.");
  }
  return value as Currency;
};

export const money = (value: number, code: string): Money => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new CommerceDomainError("invalid_money", "Money must be a non-negative safe integer in minor units.");
  }
  return Object.freeze({ value, currency: currency(code) });
};

const requireSameCurrency = (left: Money, right: Money): void => {
  if (left.currency !== right.currency) {
    throw new CommerceDomainError("currency_mismatch", "Money values must use the same currency.");
  }
};

export const addMoney = (left: Money, right: Money): Money => {
  requireSameCurrency(left, right);
  return money(left.value + right.value, left.currency);
};

export const subtractMoney = (left: Money, right: Money): Money => {
  requireSameCurrency(left, right);
  if (right.value > left.value) {
    throw new CommerceDomainError("negative_money", "Subtraction cannot produce a negative monetary value.");
  }
  return money(left.value - right.value, left.currency);
};

export const multiplyMoney = (amount: Money, quantity: number): Money => {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new CommerceDomainError("invalid_quantity", "Quantity must be a positive safe integer.");
  }
  return money(amount.value * quantity, amount.currency);
};
