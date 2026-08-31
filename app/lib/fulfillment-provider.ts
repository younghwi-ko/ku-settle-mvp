export type FulfillmentUpdate = {
  requestId: string;
  serviceType: "delivery" | "storage";
  status: string;
  processedAt: string;
};

export interface FulfillmentProvider {
  notifyStatusChange(update: FulfillmentUpdate): Promise<void>;
}

// Manual operations are the active provider. A provider API or webhook adapter
// can implement this interface later without changing request state handling.
export const manualFulfillmentProvider: FulfillmentProvider = {
  async notifyStatusChange() { /* intentionally no external delivery */ },
};
