import { FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { articles } from "@/data/content";
import { ArticleCard } from "@/components/ArticleCard";
import { useSocial } from "@/lib/social-store";
import { colors, font } from "@/theme";

export default function Saved() {
  const { bookmarks } = useSocial();
  const saved = articles.filter((a) => bookmarks[a.slug]);
  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ padding: 20 }}>
        <Text style={styles.title}>Library</Text>
        <Text style={styles.sub}>{saved.length} saved</Text>
      </View>
      {saved.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Nothing saved yet</Text>
          <Text style={styles.emptyBody}>Tap the bookmark on any story to keep it here.</Text>
        </View>
      ) : (
        <FlatList
          data={saved}
          keyExtractor={(a) => a.slug}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 32 }}
          renderItem={({ item }) => <ArticleCard article={item} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: font.display, fontSize: 34, fontStyle: "italic", color: colors.foreground },
  sub: { color: colors.mutedForeground, marginTop: 4 },
  empty: { padding: 40, alignItems: "center", gap: 6 },
  emptyTitle: { fontFamily: font.display, fontSize: 20, color: colors.foreground },
  emptyBody: { color: colors.mutedForeground, textAlign: "center" },
});
