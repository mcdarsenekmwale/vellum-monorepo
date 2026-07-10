import { useMemo, useState } from "react";
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Link, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { articles, currentUser, type Comment } from "@/data/content";
import { ArticleActions } from "@/components/ArticleActions";
import { useSocial } from "@/lib/social-store";
import { colors, font } from "@/theme";

export default function Article() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const article = articles.find((a) => a.slug === slug);
  const { comments, addComment } = useSocial();
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<string | undefined>();

  const threaded = useMemo(() => {
    if (!article) return [] as { root: Comment; replies: Comment[] }[];
    const mine = comments.filter((c) => c.articleSlug === article.slug);
    return mine.filter((c) => !c.parentId).map((root) => ({
      root,
      replies: mine.filter((r) => r.parentId === root.id),
    }));
  }, [comments, article]);

  if (!article) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, padding: 24 }}>
        <Text>Article not found.</Text>
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <Image source={{ uri: article.cover }} style={styles.cover} />
        <View style={styles.body}>
          <Text style={styles.category}>{article.category.toUpperCase()}</Text>
          <Text style={styles.title}>{article.title}</Text>
          <Link href={{ pathname: "/author/[id]", params: { id: article.author.id } }} asChild>
            <Pressable style={styles.byline}>
              <Image source={{ uri: article.author.avatar }} style={styles.bylineAvatar} />
              <View>
                <Text style={styles.bylineName}>{article.author.name}</Text>
                <Text style={styles.bylineMeta}>{article.publishedAgo} · {article.readMinutes} min read</Text>
              </View>
            </Pressable>
          </Link>
          <ArticleActions slug={article.slug} likes={article.likes} />
          <View style={{ gap: 14, marginTop: 8 }}>
            {article.body.map((p, i) => <Text key={i} style={styles.para}>{p}</Text>)}
          </View>

          <Text style={styles.commentsHeader}>{threaded.length} conversations</Text>
          {threaded.map(({ root, replies }) => (
            <View key={root.id} style={styles.comment}>
              <Image source={{ uri: root.author.avatar }} style={styles.commentAvatar} />
              <View style={{ flex: 1 }}>
                <Text style={styles.commentAuthor}>{root.author.name} <Text style={styles.commentAgo}>· {root.ago}</Text></Text>
                <Text style={styles.commentBody}>{root.body}</Text>
                <Pressable onPress={() => setReplyTo(root.id)}>
                  <Text style={styles.replyLink}>Reply</Text>
                </Pressable>
                {replies.map((r) => (
                  <View key={r.id} style={styles.reply}>
                    <Image source={{ uri: r.author.avatar }} style={styles.commentAvatarSm} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.commentAuthor}>{r.author.name} <Text style={styles.commentAgo}>· {r.ago}</Text></Text>
                      <Text style={styles.commentBody}>{r.body}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

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
          onPress={() => { addComment(article.slug, draft, replyTo); setDraft(""); setReplyTo(undefined); }}
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
  cover: { width: "100%", height: 320, backgroundColor: colors.muted },
  body: { padding: 20, gap: 12 },
  category: { fontSize: 10, letterSpacing: 2, color: colors.mutedForeground, fontWeight: "700" },
  title: { fontFamily: font.display, fontSize: 30, color: colors.foreground, lineHeight: 34 },
  byline: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 },
  bylineAvatar: { width: 40, height: 40, borderRadius: 999 },
  bylineName: { fontWeight: "600", color: colors.foreground },
  bylineMeta: { fontSize: 11, color: colors.mutedForeground },
  para: { fontSize: 16, lineHeight: 26, color: colors.foreground },
  commentsHeader: { fontFamily: font.display, fontStyle: "italic", fontSize: 20, color: colors.foreground, marginTop: 24, marginBottom: 8 },
  comment: { flexDirection: "row", gap: 10, marginBottom: 16 },
  commentAvatar: { width: 36, height: 36, borderRadius: 999 },
  commentAvatarSm: { width: 28, height: 28, borderRadius: 999 },
  commentAuthor: { fontWeight: "600", color: colors.foreground, fontSize: 13 },
  commentAgo: { color: colors.mutedForeground, fontWeight: "400" },
  commentBody: { color: colors.foreground, marginTop: 2, lineHeight: 20 },
  replyLink: { color: colors.accent, fontSize: 12, marginTop: 4, fontWeight: "600" },
  reply: { flexDirection: "row", gap: 10, marginTop: 10, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: colors.border },
  composer: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  composerInput: { flex: 1, backgroundColor: colors.background, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10, color: colors.foreground },
  sendBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, backgroundColor: colors.foreground },
  sendLabel: { color: "#fff", fontSize: 12, fontWeight: "700" },
});
