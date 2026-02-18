import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
const queryClient = new QueryClient();
export default function RootLayout() {
    return (_jsxs(QueryClientProvider, { client: queryClient, children: [_jsx(StatusBar, { style: "dark" }), _jsxs(Stack, { children: [_jsx(Stack.Screen, { name: "index", options: { title: "Waybook" } }), _jsx(Stack.Screen, { name: "waybooks/new", options: { title: "New Waybook" } }), _jsx(Stack.Screen, { name: "waybooks/[id]/index", options: { title: "Waybook" } })] })] }));
}
