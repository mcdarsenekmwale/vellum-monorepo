import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSocial } from "@/lib/social-store";
import { colors } from "@/theme";

export function ArticleActions({ slug, likes }: { slug: string; likes: number }) {
  const { likes: liked, bookmarks, toggleLike, toggleBookmark } = useSocial();
  const isLiked = !!liked[slug];
  const isSaved = !!bookmarks[slug];
  return (
    <View style={styles.row}>
      <Pressable style={styles.btn} onPress={() => toggleLike(slug)}>
        <Ionicons name={isLiked ? "heart" : "heart-outline"} size={18} color={isLiked ? colors.accent : colors.foreground} />
        <Text style={styles.label}>{likes + (isLiked ? 1 : 0)}</Text>
      </Pressable>
      <Pressable style={styles.btn} onPress={() => toggleBookmark(slug)}>
        <Ionicons name={isSaved ? "bookmark" : "bookmark-outline"} size={18} color={colors.foreground} />
        <Text style={styles.label}>{isSaved ? "Saved" : "Save"}</Text>
      </Pressable>
      <Pressable style={styles.btn}>
        <Ionicons name="share-outline" size={18} color={colors.foreground} />
        <Text style={styles.label}>Share</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8 },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  label: { fontSize: 12, fontWeight: "600", color: colors.foreground },
});
