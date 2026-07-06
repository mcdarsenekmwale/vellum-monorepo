import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { articles, currentUser } from "@/data/content";
import { useSocial } from "@/lib/social-store";
import { ArticleCard } from "@/components/ArticleCard";
import { colors, font } from "@/theme";

export default function Profile() {
  const { likes, bookmarks, follows, comments } = useSocial();
  const likedCount = Object.values(likes).filter(Boolean).length;
  const savedCount = Object.values(bookmarks).filter(Boolean).length;
  const followingCount = Object.values(follows).filter(Boolean).length;
  const myReplies = comments.filter((c) => c.author.id === currentUser.id);
  const recentSaved = articles.filter((a) => bookmarks[a.slug]).slice(0, 3);

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={styles.header}>
          <Image source={{ uri: currentUser.avatar }} style={styles.avatar} />
          <Text style={styles.name}>{currentUser.name}</Text>
          <Text style={styles.handle}>{currentUser.handle}</Text>
          {currentUser.bio && <Text style={styles.bio}>{currentUser.bio}</Text>}
        </View>

        <View style={styles.stats}>
          <Stat label="Liked" value={likedCount} />
          <Stat label="Saved" value={savedCount} />
          <Stat label="Following" value={followingCount} />
          <Stat label="Replies" value={myReplies.length} />
        </View>

        <View style={styles.actions}>
          <Link href="/notifications" asChild>
            <Pressable style={styles.actionBtn}>
              <Ionicons name="notifications-outline" size={16} color={colors.foreground} />
              <Text style={styles.actionLabel}>Notifications</Text>
            </Pressable>
          </Link>
          <Link href="/compose" asChild>
            <Pressable style={[styles.actionBtn, styles.actionPrimary]}>
              <Ionicons name="create-outline" size={16} color="#fff" />
              <Text style={[styles.actionLabel, { color: "#fff" }]}>New story</Text>
            </Pressable>
          </Link>
        </View>

        <Text style={styles.section}>Recently saved</Text>
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          {recentSaved.length === 0 ? (
            <Text style={{ color: colors.mutedForeground, paddingHorizontal: 4 }}>
              Nothing saved yet — bookmark a story to see it here.
            </Text>
          ) : (
            recentSaved.map((a) => <ArticleCard key={a.slug} article={a} />)
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={{ alignItems: "center", flex: 1 }}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", padding: 24, gap: 4 },
  avatar: { width: 92, height: 92, borderRadius: 999, marginBottom: 8 },
  name: { fontFamily: font.display, fontSize: 26, color: colors.foreground },
  handle: { color: colors.mutedForeground },
  bio: { textAlign: "center", color: colors.foreground, marginTop: 8, paddingHorizontal: 20 },
  stats: { flexDirection: "row", marginHorizontal: 16, padding: 16, backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border },
  statValue: { fontFamily: font.display, fontSize: 20, color: colors.foreground },
  statLabel: { fontSize: 10, color: colors.mutedForeground, letterSpacing: 1, marginTop: 2, textTransform: "uppercase" },
  actions: { flexDirection: "row", gap: 8, padding: 16 },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  actionPrimary: { backgroundColor: colors.foreground, borderColor: colors.foreground },
  actionLabel: { fontSize: 12, fontWeight: "600", color: colors.foreground },
  section: { fontFamily: font.display, fontStyle: "italic", fontSize: 20, color: colors.foreground, padding: 20, paddingBottom: 12 },
});
