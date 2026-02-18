import { WaybookApiClient } from "@waybook/contracts";

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8787";

export const apiClient = new WaybookApiClient(baseUrl);
