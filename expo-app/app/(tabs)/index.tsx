import { FlatList, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { articles, reels, stories } from "@/data/content";
import { ArticleCard } from "@/components/ArticleCard";
import { colors, font } from "@/theme";

export default function Feed() {
  const featured = articles.find((a) => a.featured) ?? articles[0];
  const rest = articles.filter((a) => a.slug !== featured.slug);

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>MONDAY · JULY 6</Text>
            <Text style={styles.wordmark}>Vellum</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Link href="/search" asChild>
              <Pressable style={styles.iconBtn}>
                <Ionicons name="search-outline" size={20} color={colors.foreground} />
              </Pressable>
            </Link>
            <Link href="/notifications" asChild>
              <Pressable style={styles.iconBtn}>
                <Ionicons name="notifications-outline" size={20} color={colors.foreground} />
              </Pressable>
            </Link>
          </View>
        </View>

        <FlatList
          horizontal
          data={stories}
          keyExtractor={(a) => a.id}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <Link href={{ pathname: "/author/[id]", params: { id: item.id } }} asChild>
              <Pressable style={{ alignItems: "center", width: 68 }}>
                <View style={styles.storyRing}>
                  <Image source={{ uri: item.avatar }} style={styles.storyAvatar} />
                </View>
                <Text style={styles.storyName} numberOfLines={1}>{item.name.split(" ")[0]}</Text>
              </Pressable>
            </Link>
          )}
        />

        <Link href={{ pathname: "/article/[slug]", params: { slug: featured.slug } }} asChild>
          <Pressable style={styles.hero}>
            <Image source={{ uri: featured.cover }} style={styles.heroImg} />
            <View style={styles.heroOverlay}>
              <Text style={styles.heroCategory}>{featured.category.toUpperCase()}</Text>
              <Text style={styles.heroTitle}>{featured.title}</Text>
              <Text style={styles.heroMeta}>{featured.author.name} · {featured.readMinutes} min</Text>
            </View>
          </Pressable>
        </Link>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Atmospherics</Text>
          <FlatList
            horizontal
            data={reels}
            keyExtractor={(r) => r.id}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <Link href="/reels" asChild>
                <Pressable style={styles.reelCard}>
                  <Image source={{ uri: item.cover }} style={styles.reelImg} />
                  <View style={styles.reelOverlay}>
                    <Text style={styles.reelTitle}>{item.title}</Text>
                    <Text style={styles.reelHandle}>{item.handle}</Text>
                  </View>
                </Pressable>
              </Link>
            )}
          />
        </View>

        <View style={[styles.section, { gap: 12 }]}>
          <Text style={styles.sectionTitle}>Recent</Text>
          <View style={{ paddingHorizontal: 16, gap: 10 }}>
            {rest.map((a) => <ArticleCard key={a.slug} article={a} />)}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", padding: 20 },
  eyebrow: { fontSize: 10, letterSpacing: 2, color: colors.mutedForeground, fontWeight: "700" },
  wordmark: { fontFamily: font.display, fontSize: 34, color: colors.foreground, fontStyle: "italic" },
  iconBtn: { width: 40, height: 40, borderRadius: 999, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  storyRing: { width: 62, height: 62, borderRadius: 999, borderWidth: 2, borderColor: colors.accent, alignItems: "center", justifyContent: "center" },
  storyAvatar: { width: 54, height: 54, borderRadius: 999 },
  storyName: { fontSize: 10, marginTop: 4, color: colors.foreground },
  hero: { margin: 16, borderRadius: 24, overflow: "hidden", backgroundColor: colors.muted },
  heroImg: { width: "100%", height: 380 },
  heroOverlay: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 20, backgroundColor: "rgba(0,0,0,0.35)" },
  heroCategory: { fontSize: 10, letterSpacing: 2, color: "#fff", fontWeight: "700", marginBottom: 6 },
  heroTitle: { fontFamily: font.display, fontSize: 26, color: "#fff", lineHeight: 30 },
  heroMeta: { fontSize: 11, color: "rgba(255,255,255,0.8)", marginTop: 6 },
  section: { marginTop: 8, paddingVertical: 12 },
  sectionTitle: { fontFamily: font.display, fontStyle: "italic", fontSize: 22, color: colors.foreground, paddingHorizontal: 20, marginBottom: 12 },
  reelCard: { width: 150, height: 220, borderRadius: 18, overflow: "hidden", backgroundColor: colors.muted },
  reelImg: { width: "100%", height: "100%" },
  reelOverlay: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 10, backgroundColor: "rgba(0,0,0,0.4)" },
  reelTitle: { color: "#fff", fontFamily: font.display, fontSize: 14 },
  reelHandle: { color: "rgba(255,255,255,0.75)", fontSize: 10 },
});
