import { WaybookApiClient } from "@waybook/contracts";
import * as SecureStore from "expo-secure-store";

const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:8787";

export const mobileApi = new WaybookApiClient(baseUrl, async () => {
  const token = await SecureStore.getItemAsync("waybook-token");
  return {
    ...(token ? { authorization: `Bearer ${token}` } : {})
  };
});
