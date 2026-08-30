export type TransactionalTemplateKey = "order-confirmation" | "dispatch" | "cancellation" | "refund";

export type TransactionalMessage = Readonly<{
  idempotencyKey: string;
  recipient: string;
  template: TransactionalTemplateKey;
  subject: string;
  text: string;
  html: string;
}>;

export type CommunicationReceipt = Readonly<{ providerReference: string; acceptedAt: string }>;

export interface TransactionalCommunicationProvider {
  readonly key: string;
  send(message: TransactionalMessage): Promise<CommunicationReceipt>;
}
