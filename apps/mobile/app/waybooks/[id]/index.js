import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
    const { id } = useLocalSearchParams();
    const [text, setText] = useState("");
    const enqueue = useUploadQueue((state) => state.enqueue);
    const queue = useUploadQueue((state) => state.queue);
    const dequeue = useUploadQueue((state) => state.dequeue);
    const timeline = useQuery({
        queryKey: ["waybook", id],
        queryFn: () => mobileApi.getTimeline(id)
    });
    if (!id)
        return null;
    return (_jsxs(ScrollView, { contentContainerStyle: { padding: 16, gap: 10 }, children: [_jsx(Text, { style: { fontSize: 24, fontWeight: "700" }, children: timeline.data?.waybook.title ?? "Waybook" }), _jsxs(View, { style: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, padding: 12, gap: 8 }, children: [_jsx(Text, { style: { fontWeight: "600" }, children: "Quick Entry" }), _jsx(TextInput, { value: text, onChangeText: setText, placeholder: "What happened?", multiline: true, style: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, padding: 10 } }), _jsx(Pressable, { style: { backgroundColor: "#1f4a3b", borderRadius: 8, padding: 10 }, onPress: async () => {
                            const locPerm = await Location.requestForegroundPermissionsAsync();
                            const location = locPerm.status === "granted"
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
                        }, children: _jsx(Text, { style: { color: "#fff", fontWeight: "700" }, children: "Save Entry" }) }), _jsx(Pressable, { style: { borderWidth: 1, borderColor: "#1f4a3b", borderRadius: 8, padding: 10 }, onPress: async () => {
                            const result = await ImagePicker.launchImageLibraryAsync({
                                mediaTypes: ["images"],
                                allowsMultipleSelection: false,
                                quality: 0.85
                            });
                            if (result.canceled || !result.assets.length)
                                return;
                            const asset = result.assets[0];
                            if (!asset)
                                return;
                            const entries = await mobileApi.listEntries(id);
                            const entry = entries.items[0];
                            if (!entry || !asset.fileSize || !asset.mimeType)
                                return;
                            enqueue({
                                entryId: entry.id,
                                uri: asset.uri,
                                fileName: asset.fileName ?? "photo.jpg",
                                bytes: asset.fileSize,
                                mimeType: asset.mimeType
                            });
                        }, children: _jsx(Text, { style: { color: "#1f4a3b", fontWeight: "700" }, children: "Queue Photo Upload" }) }), _jsx(Pressable, { style: { borderWidth: 1, borderColor: "#0f172a", borderRadius: 8, padding: 10 }, onPress: async () => {
                            while (true) {
                                const next = dequeue();
                                if (!next)
                                    break;
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
                        }, children: _jsxs(Text, { style: { color: "#0f172a", fontWeight: "700" }, children: ["Sync queued uploads (", queue.length, ")"] }) })] }), _jsx(Text, { style: { fontSize: 18, fontWeight: "600" }, children: "Timeline" }), timeline.data?.days.map((day) => (_jsxs(View, { style: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, padding: 10, gap: 6 }, children: [_jsx(Text, { style: { fontWeight: "700" }, children: day.date }), day.entries.map((entry) => (_jsxs(View, { style: { borderWidth: 1, borderColor: "#f1f5f9", borderRadius: 8, padding: 8 }, children: [_jsx(Text, { style: { color: "#64748b", fontSize: 12 }, children: new Date(entry.capturedAt).toLocaleTimeString() }), _jsx(Text, { children: entry.textContent ?? "(No text)" })] }, entry.id)))] }, day.date)))] }));
}
