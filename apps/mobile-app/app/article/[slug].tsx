import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Share,
  StatusBar,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Animated,
  Keyboard,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Heart,
  Bookmark,
  MessageCircle,
  Share2,
  Send,
  ChevronLeft,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useArticle, useSocialActions, useAuthState } from '../../hooks/useApi';
import { apiClient } from '../../lib/api';
import type { Comment } from '@vellum/api-client/types';
import ShimmerImage from '../../components/ShimmerImage';
import { Avatar } from '../../components/Avatar';
import { ArticleActions } from '../../components/ArticleActions';
import { useI18n } from 'context/I18nProvider';
import { useTheme } from 'context/ThemeProvider';

const { width } = Dimensions.get('window');

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = Date.now();
  const diff = now - date.getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return date.toLocaleDateString();
}

export default function ArticlePage() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { theme: { colors } } = useTheme();
  const { t } = useI18n();
  const { data: article, isLoading: articleLoading, error: articleError, refetch: refetchArticle } = useArticle(slug);
  const { toggleLike, toggleBookmark } = useSocialActions();
  const { user: currentUser } = useAuthState();
  const [commentText, setCommentText] = useState('');
  const [showAiSummary, setShowAiSummary] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [likedOverride, setLikedOverride] = useState<boolean | null>(null);
  const [bookmarkedOverride, setBookmarkedOverride] = useState<boolean | null>(null);
  const [hasCommented, setHasCommented] = useState(false);
  const composerAnimation = useRef(new Animated.Value(0)).current;
  const likeAnim = useRef(new Animated.Value(1)).current;
  const bookmarkAnim = useRef(new Animated.Value(1)).current;

  const liked = likedOverride !== null ? likedOverride : (article ? article.isLiked : false);
  const saved = bookmarkedOverride !== null ? bookmarkedOverride : (article ? article.isBookmarked : false);
  const likeCount = article ? (liked && !article.isLiked ? article.likesCount + 1 : !liked && article.isLiked ? Math.max(0, article.likesCount - 1) : article.likesCount) : 0;

  useEffect(() => {
    if (liked) {
      Animated.sequence([
        Animated.timing(likeAnim, { toValue: 1.25, duration: 150, useNativeDriver: true }),
        Animated.timing(likeAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
      ]).start();
    }
  }, [liked, likeAnim]);

  useEffect(() => {
    if (saved) {
      Animated.sequence([
        Animated.timing(bookmarkAnim, { toValue: 1.25, duration: 150, useNativeDriver: true }),
        Animated.timing(bookmarkAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
      ]).start();
    }
  }, [saved, bookmarkAnim]);

  const aiSummary = useMemo(() => {
    if (!article) return null;
    const sentences = article.body.join(' ').split(/[.!?]+/).filter(Boolean);
    const keyPoints = sentences
      .slice(0, 3)
      .map((s) => s.trim())
      .filter(Boolean);
    return {
      tlDr: article.excerpt,
      keyPoints,
      readTime: article.readMinutes,
      tone:
        article.category?.name === 'Culture'
          ? 'Thoughtful & reflective'
          : article.category?.name === 'Design'
            ? 'Analytical & design-focused'
            : article.category?.name === 'Technology'
              ? 'Technical & forward-looking'
              : 'Informative & engaging',
    };
  }, [article]);

  useEffect(() => {
    if (article) {
      loadComments();
    }
  }, [article?.slug]);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardWillShow', (e) => {
      Animated.timing(composerAnimation, {
        toValue: e.endCoordinates.height,
        duration: e.duration || 250,
        useNativeDriver: false,
      }).start();
    });
    const hideSub = Keyboard.addListener('keyboardWillHide', (e) => {
      Animated.timing(composerAnimation, {
        toValue: 0,
        duration: e.duration || 250,
        useNativeDriver: false,
      }).start();
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [composerAnimation]);

  const loadComments = async () => {
    if (!slug) return;
    setCommentsLoading(true);
    try {
      const res = await apiClient.getComments(slug as string);
      setComments(res.data);
    } catch (err) {
      console.error('Failed to load comments:', err);
    } finally {
      setCommentsLoading(false);
    }
  };

  const threads = useMemo(() => {
    const roots = comments.filter((c) => !c.parentId);
    return roots.map((r) => ({
      root: r,
      replies: r.replies || comments.filter((c) => c.parentId === r.id),
    }));
  }, [comments]);

  const handleShare = async () => {
    if (!article) return;
    try {
      await Share.share({
        message: `${article.title}\n\n${article.excerpt}`,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleLike = async () => {
    if (!article) return;
    const next = !liked;
    setLikedOverride(next);
    const result = await toggleLike(article.slug);
    if (typeof result === 'boolean') {
      setLikedOverride(result);
    } else {
      setLikedOverride(null);
    }
  };

  const handleBookmark = async () => {
    if (!article) return;
    const next = !saved;
    setBookmarkedOverride(next);
    const result = await toggleBookmark(article.slug);
    if (typeof result === 'boolean') {
      setBookmarkedOverride(result);
    } else {
      setBookmarkedOverride(null);
    }
  };

  const submitComment = async () => {
    if (!article || !commentText.trim()) return;
    try {
      await apiClient.createComment({ articleSlug: article.slug, body: commentText });
      setCommentText('');
      setHasCommented(true);
      await loadComments();
      await refetchArticle();
    } catch (err) {
      console.error('Failed to create comment:', err);
    }
  };

  if (articleLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={{ marginTop: 12, color: colors.textMuted }}>Loading article...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (articleError || !article) {
    return (
      <SafeAreaView style={styles.errorContainer} edges={['top']}>
        <Text style={styles.errorText}>{articleError ? 'Failed to load article' : 'Article not found'}</Text>
        {articleError && (
          <TouchableOpacity onPress={refetchArticle} style={{ marginTop: 16 }}>
            <Text style={{ color: colors.accent, fontWeight: '600' }}>Retry</Text>
          </TouchableOpacity>
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      {/* Sticky Header with Back Button */}
      <View style={styles.stickyHeader}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <ChevronLeft size={22} color={colors.primaryText} strokeWidth={2} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerAction}
          onPress={handleBookmark}
          activeOpacity={0.7}
        >
          <Animated.View style={{ transform: [{ scale: bookmarkAnim }] }}>
            <Bookmark
              size={20}
              color={saved ? colors.accent : colors.primaryText}
              fill={saved ? colors.accent : 'none'}
              strokeWidth={1.8}
            />
          </Animated.View>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Hero Cover Image with Bottom Gradient Overlay */}
          <View style={styles.heroContainer}>
            <ShimmerImage
              source={article.cover}
              style={styles.heroImage}
              resizeMode="cover"
              borderRadius={0}
            />

            {/* Bottom gradient overlay for text readability */}
            <View style={styles.heroGradient} pointerEvents="none" />

            {/* Category + Title overlaid on image */}
            <View style={styles.heroOverlayContent}>
              <Text style={styles.heroCategory}>{article.category?.name}</Text>
              <Text style={styles.heroTitle}>{article.title}</Text>
            </View>
          </View>

          {/* Author Row */}
          <View style={styles.authorRow}>
            <TouchableOpacity style={{ flex: 1 , flexDirection: 'row', alignItems: 'center' , gap: 10, }}  
            onPress={() => router.push(`/author/${article.author?.handle}`)}>
            <Avatar
              uri={article.author?.avatar}
              name={article.author?.name}
              handle={article.author?.handle}
              size={40}
            />
            <View style={styles.authorInfo}>
              <Text style={styles.authorName}>{article.author?.name}</Text>
              <Text style={styles.authorMeta}>
                {article.author?.handle} · {formatRelativeTime(article.publishedAt || article.createdAt)}
              </Text>
            </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.followButton} activeOpacity={0.8}>
              <Text style={styles.followButtonText}>FOLLOW</Text>
            </TouchableOpacity>
          </View>

          {/* Excerpt / Lead */}
          <Text style={styles.excerpt}>{article.excerpt}</Text>

          {/* Body Content */}
          <View style={styles.bodyContainer}>
            {article.body.map((paragraph, idx) => (
              <Text
                key={idx}
                style={[
                  styles.bodyParagraph,
                  idx === 0 && styles.bodyParagraphFirst,
                ]}
              >
                {paragraph}
              </Text>
            ))}
          </View>

          {/* Action Bar */}
          <View style={styles.actionBar}>
            <View style={{ flex: 1, gap: 12, flexDirection: 'row' }}>
              <TouchableOpacity
                style={styles.actionItem}
                onPress={handleLike}
                activeOpacity={0.7}
              >
                <Animated.View style={{ transform: [{ scale: likeAnim }] }}>
                  <Heart
                    size={20}
                    color={liked ? '#d4653a' : '#666666'}
                    fill={liked ? '#d4653a' : 'none'}
                    strokeWidth={1.8}
                  />
                </Animated.View>
                <Text style={styles.actionCount}>{likeCount.toLocaleString()}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionItem} activeOpacity={0.7}>
                <MessageCircle size={20} color={hasCommented ? '#d4653a' : '#666666'} strokeWidth={1.8} />
                <Text style={styles.actionCount}>{comments.length}</Text>
              </TouchableOpacity>
            </View>

            <View style={{ gap: 12, flexDirection: 'row' }}>
              <TouchableOpacity
                style={styles.actionItem}
                onPress={handleShare}
                activeOpacity={0.7}
              >
                <Share2 size={20} color="#666666" strokeWidth={1.8} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionItem}
                onPress={handleBookmark}
                activeOpacity={0.7}
              >
                <Animated.View style={{ transform: [{ scale: bookmarkAnim }] }}>
                  <Bookmark
                    size={20}
                    color={saved ? '#d4653a' : '#666666'}
                    fill={saved ? '#d4653a' : 'none'}
                    strokeWidth={1.8}
                  />
                </Animated.View>
              </TouchableOpacity>
            </View>
          </View>

          {/* AI Summary */}
          <View style={styles.aiSection}>
            <TouchableOpacity
              style={styles.aiHeader}
              onPress={() => setShowAiSummary(!showAiSummary)}
              activeOpacity={0.7}
            >
              <View style={styles.aiIconCircle}>
                <Sparkles size={18} color="#ffffff" />
              </View>
              <View style={styles.aiTitleGroup}>
                <Text style={styles.aiTitle}>AI Summary</Text>
                <Text style={styles.aiSubtitle}>Get the key takeaways</Text>
              </View>
              {showAiSummary ? (
                <ChevronUp size={18} color="#d4653a" />
              ) : (
                <ChevronDown size={18} color="#d4653a" />
              )}
            </TouchableOpacity>

            {showAiSummary && aiSummary && (
              <View style={styles.aiContent}>
                <Text style={styles.aiLabel}>TL;DR</Text>
                <Text style={styles.aiText}>{aiSummary.tlDr}</Text>

                <Text style={[styles.aiLabel, styles.aiLabelMargin]}>Key Points</Text>
                {aiSummary.keyPoints.map((point, i) => (
                  <View key={i} style={styles.aiPoint}>
                    <Text style={styles.aiPointNumber}>{i + 1}.</Text>
                    <Text style={styles.aiPointText}>{point}</Text>
                  </View>
                ))}

                <View style={styles.aiMetaRow}>
                  <View>
                    <Text style={styles.aiMetaLabel}>Read Time</Text>
                    <Text style={styles.aiMetaValue}>{aiSummary.readTime} min</Text>
                  </View>
                  <View>
                    <Text style={styles.aiMetaLabel}>Tone</Text>
                    <Text style={styles.aiMetaValue}>{aiSummary.tone}</Text>
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* Comments Section */}
          <View style={styles.commentsSection}>
            <Text style={styles.commentsHeader}>
              {comments.length} {comments.length === 1 ? 'Reply' : 'Replies'}
            </Text>

            {commentsLoading ? (
              <ActivityIndicator size="small" color="#d4653a" />
            ) : (
              <>
                {threads.map(({ root, replies }) => (
                  <View key={root.id} style={styles.thread}>
                    <View style={styles.commentRow}>
                      <Avatar
                        uri={root.author?.avatar}
                        name={root.author?.name}
                        handle={root.author?.handle}
                        size={36}
                      />
                      <View style={styles.commentBody}>
                        <View style={styles.commentMeta}>
                          <Text style={styles.commentAuthor}>{root.author?.name}</Text>
                          <Text style={styles.commentTime}>{formatRelativeTime(root.createdAt)}</Text>
                        </View>
                        <Text style={styles.commentText}>{root.body}</Text>
                        <View style={styles.commentActions}>
                          <TouchableOpacity hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                            <Text style={styles.commentActionText}>Reply</Text>
                          </TouchableOpacity>
                          <TouchableOpacity hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                            <Text style={styles.commentActionText}>Like</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>

                    {replies.length > 0 && (
                      <View style={styles.repliesContainer}>
                        {replies.map((r) => (
                          <View key={r.id} style={styles.replyRow}>
                            <Avatar
                              uri={r.author?.avatar}
                              name={r.author?.name}
                              handle={r.author?.handle}
                              size={28}
                            />
                            <View style={styles.replyBody}>
                              <View style={styles.replyMeta}>
                                <Text style={styles.replyAuthor}>{r.author?.name}</Text>
                                <Text style={styles.replyTime}>{formatRelativeTime(r.createdAt)}</Text>
                              </View>
                              <Text style={styles.replyText}>{r.body}</Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                ))}

                {threads.length === 0 && (
                  <Text style={styles.emptyComments}>Be the first to reply.</Text>
                )}
              </>
            )}
          </View>
        </ScrollView>

        {/* Sticky Comment Composer */}
        <Animated.View style={[styles.composer, { paddingBottom: composerAnimation }]}>
          <Avatar uri={currentUser?.avatar} name={currentUser?.name} handle={currentUser?.handle} size={32} />
          <TextInput
            value={commentText}
            onChangeText={setCommentText}
            placeholder="Add a comment..."
            placeholderTextColor="#999999"
            style={styles.composerInput}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            onPress={submitComment}
            disabled={!commentText.trim()}
            style={[
              styles.composerSend,
              !commentText.trim() && styles.composerSendDisabled,
            ]}
            activeOpacity={0.7}
          >
            <Send size={16} color="#ffffff" />
          </TouchableOpacity>
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f4ee',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#f7f4ee',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#666666',
  },

  /* Sticky Header */
  stickyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.19)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  headerAction: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.19)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },

  /* Keyboard & Scroll */
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },

  /* Hero with Bottom Gradient Overlay */
  heroContainer: {
    width: width,
    height: width * 1.2,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 130,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  heroOverlayContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 100,
  },
  heroCategory: {
    fontSize: 11,
    fontWeight: '700',
    color: '#d4653a',
    textTransform: 'uppercase',
    letterSpacing: 2.5,
    marginBottom: 12,
  },
  heroTitle: {
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    fontSize: 23,
    fontWeight: '400',
    color: '#000000',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(255,255,255,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  /* Author Row */
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e0d8',
  },
  authorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 22,
  },
  authorInfo: {
    flex: 1,
  },
  authorName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  authorMeta: {
    fontSize: 11,
    color: '#999999',
    marginTop: 2,
  },
  followButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  followButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: 1,
  },

  /* Excerpt */
  excerpt: {
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    fontSize: 18,
    color: '#333333',
    lineHeight: 28,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 8,
  },

  /* Body */
  bodyContainer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 20,
  },
  bodyParagraph: {
    fontSize: 16,
    color: '#333333',
    lineHeight: 26,
  },
  bodyParagraphFirst: {
    fontSize: 18,
    fontWeight: '500',
    color: '#1a1a1a',
    lineHeight: 30,
  },

  /* Action Bar */
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 24,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e5e0d8',
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionCount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666666',
  },

  /* AI Summary */
  aiSection: {
    paddingHorizontal: 20,
    paddingTop: 13,
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    backgroundColor: '#fff7ed',
    borderRadius: 16,
  },
  aiIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#d4653a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiTitleGroup: {
    flex: 1,
  },
  aiTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000000',
  },
  aiSubtitle: {
    fontSize: 12,
    color: '#999999',
    marginTop: 2,
  },
  aiContent: {
    marginTop: 12,
    padding: 20,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e0d8',
  },
  aiLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#d4653a',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  aiLabelMargin: {
    marginTop: 20,
    marginBottom: 10,
  },
  aiText: {
    fontSize: 14,
    color: '#404040',
    lineHeight: 22,
    marginTop: 8,
  },
  aiPoint: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  aiPointNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: '#d4653a',
  },
  aiPointText: {
    flex: 1,
    fontSize: 13,
    color: '#525252',
    lineHeight: 20,
  },
  aiMetaRow: {
    flexDirection: 'row',
    gap: 32,
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0ede8',
  },
  aiMetaLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#999999',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  aiMetaValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000000',
    marginTop: 4,
  },

  /* Comments */
  commentsSection: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 100,
  },
  commentsHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#d4653a',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 20,
  },
  thread: {
    marginBottom: 24,
  },
  commentRow: {
    flexDirection: 'row',
    gap: 12,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  commentBody: {
    flex: 1,
  },
  commentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  commentAuthor: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  commentTime: {
    fontSize: 12,
    color: '#999999',
  },
  commentText: {
    fontSize: 14,
    color: '#404040',
    marginTop: 4,
    lineHeight: 20,
  },
  commentActions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  commentActionText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#999999',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  repliesContainer: {
    marginLeft: 48,
    marginTop: 12,
    gap: 12,
    borderLeftWidth: 1.5,
    borderLeftColor: '#e5e0d8',
    paddingLeft: 12,
  },
  replyRow: {
    flexDirection: 'row',
    gap: 10,
  },
  replyAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  replyBody: {
    flex: 1,
  },
  replyMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  replyAuthor: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000000',
  },
  replyTime: {
    fontSize: 11,
    color: '#999999',
  },
  replyText: {
    fontSize: 13,
    color: '#404040',
    marginTop: 2,
    lineHeight: 18,
  },
  emptyComments: {
    fontSize: 14,
    color: '#999999',
    fontStyle: 'italic',
  },

  /* Composer */
  composer: {
    position: 'absolute',
    bottom: 4,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e0d8',
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 30 : 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  composerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  composerInput: {
    flex: 1,
    fontSize: 14,
    color: '#000000',
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: '#f5f2ed',
    borderRadius: 20,
    maxHeight: 80,
  },
  composerSend: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#d4653a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  composerSendDisabled: {
    backgroundColor: '#e5e0d8',
  },
});
