import { FlatList, Image, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { articles, authors } from "@/data/content";
import { useSocial } from "@/lib/social-store";
import { colors, font } from "@/theme";

type Item = { id: string; icon: any; who: string; what: string; ago: string; avatar: string };

export default function Notifications() {
  const { likes, comments } = useSocial();

  const items: Item[] = [];
  Object.entries(likes).forEach(([slug, on], i) => {
    if (!on) return;
    const a = articles.find((x) => x.slug === slug);
    if (!a) return;
    items.push({
      id: `like-${slug}`,
      icon: "heart",
      who: a.author.name,
      what: `liked your reply on "${a.title}"`,
      ago: `${i + 1}h`,
      avatar: a.author.avatar,
    });
  });
  comments.slice(-6).forEach((c, i) => {
    const a = articles.find((x) => x.slug === c.articleSlug);
    items.push({
      id: `reply-${c.id}`,
      icon: "chatbubble",
      who: c.author.name,
      what: `replied on "${a?.title ?? c.articleSlug}"`,
      ago: c.ago,
      avatar: c.author.avatar,
    });
  });
  authors.slice(0, 2).forEach((a, i) => {
    items.push({
      id: `follow-${a.id}`,
      icon: "person-add",
      who: a.name,
      what: "started following you",
      ago: `${i + 2}d`,
      avatar: a.avatar,
    });
  });

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ padding: 20 }}>
        <Text style={styles.title}>Activity</Text>
      </View>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 32 }}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Image source={{ uri: item.avatar }} style={styles.avatar} />
            <View style={{ flex: 1 }}>
              <Text style={styles.line}>
                <Text style={{ fontWeight: "700" }}>{item.who}</Text> {item.what}
              </Text>
              <Text style={styles.ago}>{item.ago} ago</Text>
            </View>
            <Ionicons name={item.icon} size={16} color={colors.mutedForeground} />
          </View>
        )}
        ListEmptyComponent={<Text style={{ padding: 20, color: colors.mutedForeground }}>No activity yet.</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: font.display, fontStyle: "italic", fontSize: 30, color: colors.foreground },
  row: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border },
  avatar: { width: 40, height: 40, borderRadius: 999 },
  line: { color: colors.foreground, lineHeight: 20 },
  ago: { fontSize: 11, color: colors.mutedForeground, marginTop: 2 },
});
