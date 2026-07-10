import { useMemo } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { articles } from "@/data/content";
import { ArticleCard } from "@/components/ArticleCard";
import { colors, font } from "@/theme";

export default function Discover() {
  const categories = useMemo(() => Array.from(new Set(articles.map((a) => a.category))), []);

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ padding: 20, gap: 12 }}>
        <Text style={styles.title}>Discover</Text>
        <Link href="/search" asChild>
          <Pressable style={styles.search}>
            <Ionicons name="search" size={16} color={colors.mutedForeground} />
            <Text style={{ flex: 1, color: colors.mutedForeground }}>
              Search stories, authors, ideas
            </Text>
          </Pressable>
        </Link>
        <FlatList
          horizontal
          data={categories}
          keyExtractor={(c) => c}
          contentContainerStyle={{ gap: 8 }}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <Link href={{ pathname: "/category/[name]", params: { name: item } }} asChild>
              <Pressable style={styles.chip}>
                <Text style={styles.chipLabel}>{item}</Text>
              </Pressable>
            </Link>
          )}
        />
      </View>
      <FlatList
        data={articles}
        keyExtractor={(a) => a.slug}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 32 }}
        renderItem={({ item }) => <ArticleCard article={item} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: font.display, fontSize: 34, fontStyle: "italic", color: colors.foreground },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipLabel: { fontSize: 12, fontWeight: "600", color: colors.foreground },
});

