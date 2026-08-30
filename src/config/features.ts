const enabled = (value: string | undefined): boolean => value === "true";

/**
 * Browser-facing presentation flags. These are not security controls: the
 * commerce API must independently reject commerce while COMMERCE_ENABLED is
 * false.
 */
export const features = Object.freeze({
  commerceUi: enabled(import.meta.env.PUBLIC_COMMERCE_UI_ENABLED),
  commerceOperationsUi: enabled(import.meta.env.PUBLIC_COMMERCE_OPERATIONS_UI_ENABLED),
});
