import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Link } from "expo-router";
import type { Article } from "@/data/content";
import { colors, font } from "@/theme";

export function ArticleCard({ article }: { article: Article }) {
  return (
    <Link href={{ pathname: "/article/[slug]", params: { slug: article.slug } }} asChild>
      <Pressable style={styles.card}>
        <Image source={{ uri: article.cover }} style={styles.cover} />
        <View style={styles.body}>
          <Text style={styles.category}>{article.category.toUpperCase()}</Text>
          <Text style={styles.title} numberOfLines={3}>{article.title}</Text>
          <Text style={styles.meta}>
            {article.author.name} · {article.readMinutes} min · {article.publishedAgo}
          </Text>
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    gap: 12,
    padding: 12,
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cover: { width: 96, height: 120, borderRadius: 12, backgroundColor: colors.muted },
  body: { flex: 1, justifyContent: "space-between" },
  category: { fontSize: 10, fontWeight: "700", letterSpacing: 1.5, color: colors.mutedForeground },
  title: { fontFamily: font.display, fontSize: 18, color: colors.foreground, lineHeight: 22 },
  meta: { fontSize: 11, color: colors.mutedForeground },
});
