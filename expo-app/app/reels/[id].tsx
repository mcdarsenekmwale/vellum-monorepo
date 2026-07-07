import { useMemo, useState } from "react";
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { reels, currentUser, type Comment } from "@/data/content";
import { useSocial } from "@/lib/social-store";
import { colors, font } from "@/theme";

export default function ReelDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const reel = reels.find((r) => r.id === id);
  const { likes, bookmarks, comments, toggleLike, toggleBookmark, addComment } = useSocial();
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<string | undefined>();

  const likeKey = `reel:${id}`;
  const saveKey = `reel:${id}`;
  const commentSlug = `reel:${id ?? ""}`;

  const threaded = useMemo(() => {
    const mine = comments.filter((c) => c.articleSlug === commentSlug);
    return mine
      .filter((c) => !c.parentId)
      .map((root) => ({
        root,
        replies: mine.filter((r) => r.parentId === root.id),
      }));
  }, [comments, commentSlug]);

  if (!reel) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, padding: 24 }}>
        <Text>Reel not found.</Text>
      </SafeAreaView>
    );
  }

  const isLiked = !!likes[likeKey];
  const isSaved = !!bookmarks[saveKey];
  const replyingTo: Comment | undefined = replyTo
    ? threaded.flatMap((t) => [t.root, ...t.replies]).find((c) => c.id === replyTo)
    : undefined;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: "#000" }}
    >
      <ScrollView contentContainerStyle={{ paddingBottom: 20 }} style={{ backgroundColor: colors.background }}>
        <View style={styles.hero}>
          <Image source={{ uri: reel.cover }} style={StyleSheet.absoluteFillObject} />
          <View style={styles.heroOverlay} />
          <SafeAreaView edges={["top"]} style={styles.heroSafe}>
            <Pressable onPress={() => router.back()} style={styles.iconBtn}>
              <Ionicons name="chevron-back" size={20} color="#fff" />
            </Pressable>
            <Text style={styles.heroBadge}>REEL</Text>
            <View style={{ width: 40 }} />
          </SafeAreaView>
          <View style={styles.heroBottom}>
            <Text style={styles.heroHandle}>{reel.handle}</Text>
            <Text style={styles.heroTitle}>{reel.title}</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable style={styles.actionBtn} onPress={() => toggleLike(likeKey)}>
            <Ionicons name={isLiked ? "heart" : "heart-outline"} size={18} color={isLiked ? colors.accent : colors.foreground} />
            <Text style={styles.actionLabel}>{(reel.likes + (isLiked ? 1 : 0)).toLocaleString()}</Text>
          </Pressable>
          <Pressable style={styles.actionBtn}>
            <Ionicons name="chatbubble-outline" size={18} color={colors.foreground} />
            <Text style={styles.actionLabel}>{threaded.length + threaded.reduce((n, t) => n + t.replies.length, 0)}</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={() => toggleBookmark(saveKey)}>
            <Ionicons name={isSaved ? "bookmark" : "bookmark-outline"} size={18} color={colors.foreground} />
            <Text style={styles.actionLabel}>{isSaved ? "Saved" : "Save"}</Text>
          </Pressable>
          <Pressable style={styles.actionBtn}>
            <Ionicons name="share-outline" size={18} color={colors.foreground} />
            <Text style={styles.actionLabel}>Share</Text>
          </Pressable>
        </View>

        <View style={styles.body}>
          <Text style={styles.commentsHeader}>
            {threaded.length === 0 ? "Start the conversation" : `${threaded.length} conversations`}
          </Text>
          {threaded.map(({ root, replies }) => (
            <View key={root.id} style={styles.comment}>
              <Image source={{ uri: root.author.avatar }} style={styles.commentAvatar} />
              <View style={{ flex: 1 }}>
                <Text style={styles.commentAuthor}>
                  {root.author.name} <Text style={styles.commentAgo}>· {root.ago}</Text>
                </Text>
                <Text style={styles.commentBody}>{root.body}</Text>
                <Pressable onPress={() => setReplyTo(root.id)}>
                  <Text style={styles.replyLink}>Reply</Text>
                </Pressable>
                {replies.map((r) => (
                  <View key={r.id} style={styles.reply}>
                    <Image source={{ uri: r.author.avatar }} style={styles.commentAvatarSm} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.commentAuthor}>
                        {r.author.name} <Text style={styles.commentAgo}>· {r.ago}</Text>
                      </Text>
                      <Text style={styles.commentBody}>{r.body}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {replyingTo ? (
        <View style={styles.replyBanner}>
          <Text style={styles.replyBannerText} numberOfLines={1}>
            Replying to {replyingTo.author.name}
          </Text>
          <Pressable onPress={() => setReplyTo(undefined)}>
            <Ionicons name="close" size={16} color={colors.mutedForeground} />
          </Pressable>
        </View>
      ) : null}
      <View style={styles.composer}>
        <Image source={{ uri: currentUser.avatar }} style={styles.commentAvatarSm} />
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={replyTo ? "Write a reply…" : "Add a comment…"}
          placeholderTextColor={colors.mutedForeground}
          style={styles.composerInput}
        />
        <Pressable
          onPress={() => {
            addComment(commentSlug, draft, replyTo);
            setDraft("");
            setReplyTo(undefined);
          }}
          style={[styles.sendBtn, { opacity: draft.trim() ? 1 : 0.4 }]}
          disabled={!draft.trim()}
        >
          <Text style={styles.sendLabel}>Post</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  hero: { height: 420, backgroundColor: "#000", overflow: "hidden" },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.35)" },
  heroSafe: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 8 },
  iconBtn: { width: 40, height: 40, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.16)" },
  heroBadge: { color: "#fff", fontSize: 10, letterSpacing: 2, fontWeight: "700" },
  heroBottom: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 20 },
  heroHandle: { color: "rgba(255,255,255,0.75)", fontSize: 11, fontWeight: "600", marginBottom: 4 },
  heroTitle: { color: "#fff", fontFamily: font.display, fontStyle: "italic", fontSize: 28, lineHeight: 32 },
  actions: { flexDirection: "row", gap: 8, padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  actionLabel: { fontSize: 12, fontWeight: "600", color: colors.foreground },
  body: { padding: 20, gap: 12 },
  commentsHeader: { fontFamily: font.display, fontStyle: "italic", fontSize: 20, color: colors.foreground, marginBottom: 4 },
  comment: { flexDirection: "row", gap: 10, marginBottom: 16 },
  commentAvatar: { width: 36, height: 36, borderRadius: 999 },
  commentAvatarSm: { width: 28, height: 28, borderRadius: 999 },
  commentAuthor: { fontWeight: "600", color: colors.foreground, fontSize: 13 },
  commentAgo: { color: colors.mutedForeground, fontWeight: "400" },
  commentBody: { color: colors.foreground, marginTop: 2, lineHeight: 20 },
  replyLink: { color: colors.accent, fontSize: 12, marginTop: 4, fontWeight: "600" },
  reply: { flexDirection: "row", gap: 10, marginTop: 10, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: colors.border },
  replyBanner: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 8, backgroundColor: colors.muted, borderTopWidth: 1, borderTopColor: colors.border },
  replyBannerText: { fontSize: 12, color: colors.mutedForeground, flex: 1 },
  composer: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  composerInput: { flex: 1, backgroundColor: colors.background, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10, color: colors.foreground },
  sendBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, backgroundColor: colors.foreground },
  sendLabel: { color: "#fff", fontSize: 12, fontWeight: "700" },
});
