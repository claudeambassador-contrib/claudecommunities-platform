export type ConnectionStatus = "accepted" | "pending" | "rejected";
export type ConnectionListFilter = "all" | "received" | "sent";

export interface ConnectionItem {
  createdAt: string;
  id: string;
  receiverId: string;
  requesterId: string;
  status: ConnectionStatus;
  updatedAt: string;
}

export interface ListConnectionsOptions {
  filter?: ConnectionListFilter;
  status?: ConnectionStatus;
}
