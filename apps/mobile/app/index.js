import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { mobileApi } from "../src/lib/api";
export default function HomeScreen() {
    const waybooks = useQuery({
        queryKey: ["waybooks"],
        queryFn: () => mobileApi.listWaybooks()
    });
    return (_jsxs(ScrollView, { contentContainerStyle: { padding: 16, gap: 12 }, children: [_jsx(Text, { style: { fontSize: 26, fontWeight: "700" }, children: "Your Waybooks" }), _jsx(Link, { asChild: true, href: "/waybooks/new", children: _jsx(Pressable, { style: { backgroundColor: "#1f4a3b", borderRadius: 8, padding: 12 }, children: _jsx(Text, { style: { color: "#fff", fontWeight: "600" }, children: "Create waybook" }) }) }), waybooks.data?.items.map((waybook) => (_jsx(Link, { asChild: true, href: `/waybooks/${waybook.id}`, children: _jsxs(Pressable, { style: { backgroundColor: "#fff", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#e2e8f0" }, children: [_jsx(Text, { style: { fontSize: 18, fontWeight: "600" }, children: waybook.title }), _jsxs(Text, { style: { color: "#475569" }, children: [waybook.startDate, " to ", waybook.endDate] })] }) }, waybook.id))), waybooks.isLoading ? _jsx(Text, { children: "Loading..." }) : null, waybooks.isError ? _jsx(Text, { children: "Failed to load waybooks." }) : null] }));
}
