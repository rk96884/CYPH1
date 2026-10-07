export type CommunicationFailureKind = "retryable" | "permanent" | "ambiguous";
export class CommunicationFailure extends Error {
  constructor(readonly kind: CommunicationFailureKind, readonly code: string) {
    super(code); this.name = "CommunicationFailure";
  }
}
