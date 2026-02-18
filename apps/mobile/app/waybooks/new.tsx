import { useState } from "react";
import { router } from "expo-router";
import { Pressable, Text, TextInput, View } from "react-native";
import { mobileApi } from "../../src/lib/api";

export default function NewWaybookScreen() {
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [description, setDescription] = useState("");

  return (
    <View style={{ padding: 16, gap: 10 }}>
      <TextInput placeholder="Trip title" value={title} onChangeText={setTitle} style={{ borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, padding: 10 }} />
      <TextInput placeholder="Start date (YYYY-MM-DD)" value={startDate} onChangeText={setStartDate} style={{ borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, padding: 10 }} />
      <TextInput placeholder="End date (YYYY-MM-DD)" value={endDate} onChangeText={setEndDate} style={{ borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, padding: 10 }} />
      <TextInput placeholder="Description" value={description} onChangeText={setDescription} style={{ borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, padding: 10 }} multiline />

      <Pressable
        style={{ backgroundColor: "#1f4a3b", borderRadius: 8, padding: 12 }}
        onPress={async () => {
          const created = await mobileApi.createWaybook({
            title,
            startDate,
            endDate,
            description: description || null,
            visibility: "private"
          });
          router.replace(`/waybooks/${created.id}`);
        }}
      >
        <Text style={{ color: "#fff", fontWeight: "700" }}>Create</Text>
      </Pressable>
    </View>
  );
}
