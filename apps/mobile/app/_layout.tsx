import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";

const queryClient = new QueryClient();

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      <Stack>
        <Stack.Screen name="index" options={{ title: "Waybook" }} />
        <Stack.Screen name="waybooks/new" options={{ title: "New Waybook" }} />
        <Stack.Screen name="waybooks/[id]/index" options={{ title: "Waybook" }} />
      </Stack>
    </QueryClientProvider>
  );
}
