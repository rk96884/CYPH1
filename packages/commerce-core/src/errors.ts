export class CommerceDomainError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "CommerceDomainError";
    this.code = code;
  }
}
