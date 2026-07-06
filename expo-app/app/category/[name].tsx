import { FlatList, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { articles } from "@/data/content";
import { ArticleCard } from "@/components/ArticleCard";
import { colors, font } from "@/theme";

export default function Category() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const list = articles.filter((a) => a.category.toLowerCase() === (name ?? "").toLowerCase());
  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ padding: 20 }}>
        <Text style={styles.eyebrow}>CATEGORY</Text>
        <Text style={styles.title}>{name}</Text>
        <Text style={styles.sub}>{list.length} stories</Text>
      </View>
      <FlatList
        data={list}
        keyExtractor={(a) => a.slug}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 32 }}
        renderItem={({ item }) => <ArticleCard article={item} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  eyebrow: { fontSize: 10, letterSpacing: 2, color: colors.mutedForeground, fontWeight: "700" },
  title: { fontFamily: font.display, fontStyle: "italic", fontSize: 34, color: colors.foreground },
  sub: { color: colors.mutedForeground, marginTop: 4 },
});
