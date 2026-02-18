import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { mobileApi } from "../src/lib/api";

export default function HomeScreen() {
  const waybooks = useQuery({
    queryKey: ["waybooks"],
    queryFn: () => mobileApi.listWaybooks()
  });

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 26, fontWeight: "700" }}>Your Waybooks</Text>
      <Link asChild href="/waybooks/new">
        <Pressable style={{ backgroundColor: "#1f4a3b", borderRadius: 8, padding: 12 }}>
          <Text style={{ color: "#fff", fontWeight: "600" }}>Create waybook</Text>
        </Pressable>
      </Link>

      {waybooks.data?.items.map((waybook) => (
        <Link asChild key={waybook.id} href={`/waybooks/${waybook.id}`}>
          <Pressable style={{ backgroundColor: "#fff", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#e2e8f0" }}>
            <Text style={{ fontSize: 18, fontWeight: "600" }}>{waybook.title}</Text>
            <Text style={{ color: "#475569" }}>{waybook.startDate} to {waybook.endDate}</Text>
          </Pressable>
        </Link>
      ))}

      {waybooks.isLoading ? <Text>Loading...</Text> : null}
      {waybooks.isError ? <Text>Failed to load waybooks.</Text> : null}
    </ScrollView>
  );
}
