import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { articles, authors } from "@/data/content";
import { ArticleCard } from "@/components/ArticleCard";
import { useSocial } from "@/lib/social-store";
import { colors, font } from "@/theme";

export default function Author() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const author = authors.find((a) => a.id === id);
  const { follows, toggleFollow } = useSocial();
  const isFollowing = !!(id && follows[id]);
  const authorArticles = articles.filter((a) => a.author.id === id);

  if (!author) {
    return (
      <SafeAreaView style={{ flex: 1, padding: 24, backgroundColor: colors.background }}>
        <Text>Author not found.</Text>
      </SafeAreaView>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ paddingBottom: 32 }}>
      <View style={styles.header}>
        <Image source={{ uri: author.avatar }} style={styles.avatar} />
        <Text style={styles.name}>{author.name}</Text>
        <Text style={styles.handle}>{author.handle}{author.publication ? ` · ${author.publication}` : ""}</Text>
        {author.bio && <Text style={styles.bio}>{author.bio}</Text>}
        <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
          <Pressable
            onPress={() => id && toggleFollow(id)}
            style={[styles.btn, isFollowing ? styles.btnGhost : styles.btnPrimary]}
          >
            <Text style={[styles.btnLabel, { color: isFollowing ? colors.foreground : "#fff" }]}>
              {isFollowing ? "Following" : "Follow"}
            </Text>
          </Pressable>
          <Pressable style={[styles.btn, styles.btnGhost]}>
            <Text style={styles.btnLabel}>Message</Text>
          </Pressable>
        </View>
      </View>
      <Text style={styles.section}>Stories</Text>
      <View style={{ paddingHorizontal: 16, gap: 10 }}>
        {authorArticles.length === 0
          ? <Text style={{ color: colors.mutedForeground, paddingHorizontal: 4 }}>No published stories yet.</Text>
          : authorArticles.map((a) => <ArticleCard key={a.slug} article={a} />)}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", padding: 24, gap: 4 },
  avatar: { width: 92, height: 92, borderRadius: 999, marginBottom: 8 },
  name: { fontFamily: font.display, fontSize: 26, color: colors.foreground },
  handle: { color: colors.mutedForeground },
  bio: { textAlign: "center", color: colors.foreground, marginTop: 8, paddingHorizontal: 20 },
  btn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999 },
  btnPrimary: { backgroundColor: colors.foreground },
  btnGhost: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  btnLabel: { fontSize: 12, fontWeight: "700" },
  section: { fontFamily: font.display, fontStyle: "italic", fontSize: 20, color: colors.foreground, padding: 20, paddingBottom: 12 },
});
