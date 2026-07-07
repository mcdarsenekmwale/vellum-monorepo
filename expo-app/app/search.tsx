import { useMemo, useState } from "react";
import { FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { articles, authors } from "@/data/content";
import { colors, font } from "@/theme";

type Section =
  | { kind: "stories"; title: string; data: typeof articles }
  | { kind: "authors"; title: string; data: typeof authors }
  | { kind: "categories"; title: string; data: string[] };

export default function SearchScreen() {
  const router = useRouter();
  const { q: initial } = useLocalSearchParams<{ q?: string }>();
  const [q, setQ] = useState(initial ?? "");

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const allCategories = Array.from(new Set(articles.map((a) => a.category)));
    if (!needle) {
      return {
        stories: [] as typeof articles,
        authors: [] as typeof authors,
        categories: allCategories,
      };
    }
    return {
      stories: articles.filter((a) =>
        [a.title, a.excerpt, a.category, a.author.name].join(" ").toLowerCase().includes(needle),
      ),
      authors: authors.filter((au) =>
        [au.name, au.handle, au.publication ?? "", au.bio ?? ""].join(" ").toLowerCase().includes(needle),
      ),
      categories: allCategories.filter((c) => c.toLowerCase().includes(needle)),
    };
  }, [q]);

  const sections: Section[] = [
    { kind: "authors", title: "People", data: results.authors },
    { kind: "stories", title: "Stories", data: results.stories },
    { kind: "categories", title: "Sections", data: results.categories },
  ];

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={colors.foreground} />
        </Pressable>
        <View style={styles.search}>
          <Ionicons name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            autoFocus
            value={q}
            onChangeText={setQ}
            placeholder="Search stories, authors, sections"
            placeholderTextColor={colors.mutedForeground}
            style={{ flex: 1, color: colors.foreground }}
            returnKeyType="search"
          />
          {q.length > 0 ? (
            <Pressable onPress={() => setQ("")}>
              <Ionicons name="close-circle" size={16} color={colors.mutedForeground} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <FlatList
        data={sections}
        keyExtractor={(s) => s.kind}
        contentContainerStyle={{ paddingBottom: 32 }}
        renderItem={({ item }) => {
          if (item.data.length === 0) {
            if (!q.trim()) return null;
            return (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{item.title}</Text>
                <Text style={styles.empty}>No matches.</Text>
              </View>
            );
          }
          return (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {item.title} · {item.data.length}
              </Text>
              {item.kind === "authors" &&
                (item.data as typeof authors).map((a) => (
                  <Link key={a.id} href={{ pathname: "/author/[id]", params: { id: a.id } }} asChild>
                    <Pressable style={styles.row}>
                      <Image source={{ uri: a.avatar }} style={styles.avatar} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowTitle}>{a.name}</Text>
                        <Text style={styles.rowMeta}>{a.publication ?? a.handle}</Text>
                      </View>
                      <Text style={styles.cta}>View</Text>
                    </Pressable>
                  </Link>
                ))}
              {item.kind === "stories" &&
                (item.data as typeof articles).map((a) => (
                  <Link key={a.slug} href={{ pathname: "/article/[slug]", params: { slug: a.slug } }} asChild>
                    <Pressable style={styles.row}>
                      <Image source={{ uri: a.cover }} style={styles.thumb} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.eyebrow}>{a.category.toUpperCase()}</Text>
                        <Text style={styles.rowTitle} numberOfLines={2}>{a.title}</Text>
                        <Text style={styles.rowMeta}>{a.author.name}</Text>
                      </View>
                    </Pressable>
                  </Link>
                ))}
              {item.kind === "categories" && (
                <View style={styles.chipWrap}>
                  {(item.data as string[]).map((c) => (
                    <Link key={c} href={{ pathname: "/category/[name]", params: { name: c } }} asChild>
                      <Pressable style={styles.chip}>
                        <Text style={styles.chipLabel}>{c}</Text>
                      </Pressable>
                    </Link>
                  ))}
                </View>
              )}
            </View>
          );
        }}
        ListEmptyComponent={null}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 8, padding: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 999, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  search: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.surface, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: colors.border },
  section: { paddingHorizontal: 20, paddingTop: 18, gap: 10 },
  sectionTitle: { fontFamily: font.display, fontStyle: "italic", fontSize: 20, color: colors.foreground },
  empty: { color: colors.mutedForeground, fontSize: 13 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  avatar: { width: 44, height: 44, borderRadius: 999 },
  thumb: { width: 64, height: 64, borderRadius: 12, backgroundColor: colors.muted },
  rowTitle: { fontSize: 14, fontWeight: "600", color: colors.foreground },
  rowMeta: { fontSize: 11, color: colors.mutedForeground, marginTop: 2 },
  eyebrow: { fontSize: 9, letterSpacing: 1.5, color: colors.accent, fontWeight: "700", marginBottom: 2 },
  cta: { fontSize: 10, fontWeight: "700", letterSpacing: 1.5, color: colors.accent },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipLabel: { fontSize: 12, fontWeight: "600", color: colors.foreground },
});
