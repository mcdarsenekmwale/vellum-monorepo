import { useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { colors, font } from "@/theme";

const SECTIONS = ["Culture", "Design", "Environment", "Music", "Architecture", "Field notes"];

export default function Compose() {
  const router = useRouter();
  const [section, setSection] = useState(SECTIONS[0]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const words = useMemo(() => body.trim().split(/\s+/).filter(Boolean).length, [body]);

  const publish = () => {
    if (!title.trim() || !body.trim()) {
      Alert.alert("Missing content", "Add a title and body before publishing.");
      return;
    }
    Alert.alert("Story submitted", `"${title.trim()}" saved as a draft (${words} words).`);
    router.back();
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}>
        <Text style={styles.eyebrow}>NEW STORY</Text>
        <View style={styles.sections}>
          {SECTIONS.map((s) => {
            const active = s === section;
            return (
              <Pressable key={s} onPress={() => setSection(s)} style={[styles.chip, active && styles.chipActive]}>
                <Text style={[styles.chipLabel, active && { color: "#fff" }]}>{s}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.coverSlot}>
          <Text style={{ color: colors.mutedForeground }}>+ Add cover image</Text>
        </View>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="A title worth reading"
          placeholderTextColor={colors.mutedForeground}
          style={styles.title}
          multiline
        />
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="Start writing…"
          placeholderTextColor={colors.mutedForeground}
          style={styles.body}
          multiline
          textAlignVertical="top"
        />
        <Text style={styles.wordCount}>{words} words</Text>
        <Pressable style={styles.publish} onPress={publish}>
          <Text style={styles.publishLabel}>Publish</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  eyebrow: { fontSize: 10, letterSpacing: 2, color: colors.mutedForeground, fontWeight: "700" },
  sections: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.foreground, borderColor: colors.foreground },
  chipLabel: { fontSize: 12, fontWeight: "600", color: colors.foreground },
  coverSlot: { height: 160, borderRadius: 20, borderWidth: 1, borderStyle: "dashed", borderColor: colors.border, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  title: { fontFamily: font.display, fontSize: 30, color: colors.foreground, lineHeight: 34, paddingVertical: 8 },
  body: { minHeight: 240, fontSize: 16, lineHeight: 26, color: colors.foreground },
  wordCount: { fontSize: 11, color: colors.mutedForeground, textAlign: "right" },
  publish: { backgroundColor: colors.foreground, paddingVertical: 14, borderRadius: 999, alignItems: "center" },
  publishLabel: { color: "#fff", fontWeight: "700", letterSpacing: 1 },
});
