import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as Crypto from "expo-crypto";
import { useQuery } from "@tanstack/react-query";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { mobileApi } from "../../../src/lib/api";
import { useUploadQueue } from "../../../src/store/upload-queue";

export default function WaybookScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [text, setText] = useState("");
  const [planTitle, setPlanTitle] = useState("");
  const [bookingTitle, setBookingTitle] = useState("");
  const [expenseTitle, setExpenseTitle] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const enqueue = useUploadQueue((state) => state.enqueue);
  const queue = useUploadQueue((state) => state.queue);
  const dequeue = useUploadQueue((state) => state.dequeue);

  const timeline = useQuery({
    queryKey: ["waybook", id],
    queryFn: () => mobileApi.getTimeline(id)
  });
  const planning = useQuery({
    queryKey: ["planning", id],
    queryFn: () => mobileApi.listPlanningItems(id)
  });
  const bookings = useQuery({
    queryKey: ["bookings", id],
    queryFn: () => mobileApi.listBookings(id)
  });
  const stageState = useQuery({
    queryKey: ["stage-state", id],
    queryFn: () => mobileApi.getStageState(id)
  });
  const scenarios = useQuery({
    queryKey: ["scenarios", id],
    queryFn: () => mobileApi.listScenarios(id)
  });
  const decisionRounds = useQuery({
    queryKey: ["decision-rounds", id],
    queryFn: () => mobileApi.listDecisionRounds(id)
  });
  const digest = useQuery({
    queryKey: ["digest", id],
    queryFn: () => mobileApi.getTodayDigest(id)
  });
  const expenses = useQuery({
    queryKey: ["expenses", id],
    queryFn: () => mobileApi.listExpenses(id)
  });

  if (!id) return null;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
      <Text style={{ fontSize: 24, fontWeight: "700" }}>{timeline.data?.waybook.title ?? "Waybook"}</Text>

      <View style={{ borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, padding: 12, gap: 8 }}>
        <Text style={{ fontWeight: "700" }}>Lifecycle + AI</Text>
        <Text style={{ color: "#475569", fontSize: 12 }}>
          Stage: {stageState.data?.currentStage ?? "destinations"}
        </Text>
        <Text style={{ color: "#475569", fontSize: 12 }}>
          Next actions: {digest.data?.nextActions.map((action) => action.title).join(" • ") || "none"}
        </Text>
        <Text style={{ color: "#475569", fontSize: 12 }}>
          Scenarios: {scenarios.data?.items.length ?? 0} · Decision rounds: {decisionRounds.data?.items.length ?? 0}
        </Text>
        {scenarios.data?.items.slice(0, 2).map((scenario) => (
          <View key={scenario.id} style={{ borderWidth: 1, borderColor: "#f1f5f9", borderRadius: 8, padding: 8 }}>
            <Text style={{ fontWeight: "600" }}>{scenario.title}</Text>
            <Text style={{ color: "#64748b", fontSize: 12 }}>{scenario.description ?? "No description"}</Text>
            <Text style={{ color: "#64748b", fontSize: 12 }}>
              {scenario.items.slice(0, 2).map((item) => `${item.itemType}: ${item.label}`).join(" • ")}
            </Text>
          </View>
        ))}
      </View>

      <View style={{ borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, padding: 12, gap: 8 }}>
        <Text style={{ fontWeight: "600" }}>Quick Entry</Text>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="What happened?"
          multiline
          style={{ borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, padding: 10 }}
        />
        <Pressable
          style={{ backgroundColor: "#1f4a3b", borderRadius: 8, padding: 10 }}
          onPress={async () => {
            const locPerm = await Location.requestForegroundPermissionsAsync();
            const location =
              locPerm.status === "granted"
                ? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
                : null;

            await mobileApi.createEntry(id, {
              capturedAt: new Date().toISOString(),
              textContent: text || null,
              location: location
                ? {
                    lat: location.coords.latitude,
                    lng: location.coords.longitude,
                    placeName: null
                  }
                : null,
              idempotencyKey: Crypto.randomUUID()
            });

            setText("");
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "700" }}>Save Entry</Text>
        </Pressable>

        <Pressable
          style={{ borderWidth: 1, borderColor: "#1f4a3b", borderRadius: 8, padding: 10 }}
          onPress={async () => {
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ["images"],
              allowsMultipleSelection: false,
              quality: 0.85
            });

            if (result.canceled || !result.assets.length) return;
            const asset = result.assets[0];
            if (!asset) return;

            const entries = await mobileApi.listEntries(id);
            const entry = entries.items[0];
            if (!entry || !asset.fileSize || !asset.mimeType) return;

            enqueue({
              entryId: entry.id,
              uri: asset.uri,
              fileName: asset.fileName ?? "photo.jpg",
              bytes: asset.fileSize,
              mimeType: asset.mimeType
            });
          }}
        >
          <Text style={{ color: "#1f4a3b", fontWeight: "700" }}>Queue Photo Upload</Text>
        </Pressable>

        <Pressable
          style={{ borderWidth: 1, borderColor: "#0f172a", borderRadius: 8, padding: 10 }}
          onPress={async () => {
            while (true) {
              const next = dequeue();
              if (!next) break;

              const upload = await mobileApi.createUploadUrl(next.entryId, {
                type: "photo",
                mimeType: next.mimeType,
                bytes: next.bytes,
                fileName: next.fileName,
                idempotencyKey: Crypto.randomUUID()
              });

              const fileResponse = await fetch(next.uri);
              const blob = await fileResponse.blob();

              await fetch(upload.uploadUrl, {
                method: "PUT",
                headers: upload.requiredHeaders,
                body: blob
              });

              await mobileApi.completeUpload(upload.mediaId, Crypto.randomUUID());
            }
          }}
        >
          <Text style={{ color: "#0f172a", fontWeight: "700" }}>Sync queued uploads ({queue.length})</Text>
        </Pressable>
      </View>

      <View style={{ borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, padding: 12, gap: 8 }}>
        <Text style={{ fontWeight: "700" }}>Plan</Text>
        <TextInput
          value={planTitle}
          onChangeText={setPlanTitle}
          placeholder="Add planning idea"
          style={{ borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, padding: 10 }}
        />
        <Pressable
          style={{ backgroundColor: "#1f4a3b", borderRadius: 8, padding: 10 }}
          onPress={async () => {
            if (!planTitle.trim()) return;
            await mobileApi.createPlanningItem(id, { title: planTitle.trim(), location: null });
            setPlanTitle("");
            await planning.refetch();
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "700" }}>Add idea</Text>
        </Pressable>
        {planning.data?.items.map((item) => (
          <View key={item.id} style={{ borderWidth: 1, borderColor: "#f1f5f9", borderRadius: 8, padding: 8 }}>
            <Text style={{ fontWeight: "600" }}>{item.title}</Text>
            <Text style={{ color: "#64748b", fontSize: 12 }}>{item.status}</Text>
          </View>
        ))}
      </View>

      <View style={{ borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, padding: 12, gap: 8 }}>
        <Text style={{ fontWeight: "700" }}>Bookings</Text>
        <TextInput
          value={bookingTitle}
          onChangeText={setBookingTitle}
          placeholder="Booking title"
          style={{ borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, padding: 10 }}
        />
        <Pressable
          style={{ backgroundColor: "#1f4a3b", borderRadius: 8, padding: 10 }}
          onPress={async () => {
            if (!bookingTitle.trim()) return;
            await mobileApi.createBooking(id, { title: bookingTitle.trim(), type: "activity" });
            setBookingTitle("");
            await bookings.refetch();
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "700" }}>Add booking</Text>
        </Pressable>
        {bookings.data?.items.map((item) => (
          <View key={item.id} style={{ borderWidth: 1, borderColor: "#f1f5f9", borderRadius: 8, padding: 8 }}>
            <Text style={{ fontWeight: "600" }}>{item.title}</Text>
            <Text style={{ color: "#64748b", fontSize: 12 }}>
              {item.type} · {item.bookingStatus}
            </Text>
          </View>
        ))}
      </View>

      <View style={{ borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, padding: 12, gap: 8 }}>
        <Text style={{ fontWeight: "700" }}>Expenses</Text>
        <TextInput
          value={expenseTitle}
          onChangeText={setExpenseTitle}
          placeholder="Expense title"
          style={{ borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, padding: 10 }}
        />
        <TextInput
          value={expenseAmount}
          onChangeText={setExpenseAmount}
          placeholder="Amount (USD)"
          keyboardType="numeric"
          style={{ borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, padding: 10 }}
        />
        <Pressable
          style={{ backgroundColor: "#1f4a3b", borderRadius: 8, padding: 10 }}
          onPress={async () => {
            const amount = Number(expenseAmount);
            const userId = timeline.data?.waybook.userId;
            if (!expenseTitle.trim() || Number.isNaN(amount) || amount <= 0 || !userId) return;
            await mobileApi.createExpense(id, {
              title: expenseTitle.trim(),
              paidByUserId: userId,
              currency: "USD",
              amountMinor: Math.round(amount * 100),
              tripBaseCurrency: "USD",
              tripBaseAmountMinor: Math.round(amount * 100),
              incurredAt: new Date().toISOString(),
              splits: []
            });
            setExpenseTitle("");
            setExpenseAmount("");
            await expenses.refetch();
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "700" }}>Add expense</Text>
        </Pressable>
        {expenses.data?.items.map((item) => (
          <View key={item.id} style={{ borderWidth: 1, borderColor: "#f1f5f9", borderRadius: 8, padding: 8 }}>
            <Text style={{ fontWeight: "600" }}>{item.title}</Text>
            <Text style={{ color: "#64748b", fontSize: 12 }}>
              {(item.amountMinor / 100).toFixed(2)} {item.currency}
            </Text>
          </View>
        ))}
      </View>

      <Text style={{ fontSize: 18, fontWeight: "600" }}>Timeline</Text>
      {timeline.data?.days.map((day) => (
        <View key={day.date} style={{ borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, padding: 10, gap: 6 }}>
          <Text style={{ fontWeight: "700" }}>{day.date}</Text>
          {day.entries.map((entry) => (
            <View key={entry.id} style={{ borderWidth: 1, borderColor: "#f1f5f9", borderRadius: 8, padding: 8 }}>
              <Text style={{ color: "#64748b", fontSize: 12 }}>{new Date(entry.capturedAt).toLocaleTimeString()}</Text>
              <Text>{entry.textContent ?? "(No text)"}</Text>
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}
