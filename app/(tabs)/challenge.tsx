import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { apiRequest } from '../../lib/api';

const { width } = Dimensions.get('window');

const TABS = ['CHALLENGES', 'COMMUNITY'];

// ── Active Challenge Chats ──
const activeChats = [
  { id: 'c1', name: '30-Day Push-Up Challenge', lastMsg: 'Coach: Day 12 — keep pushing! 💪', time: '2m ago', unread: 3, avatar: '💪' },
  { id: 'c2', name: '7-Day Morning Run', lastMsg: 'You: Done! 5km in 28 mins 🏃', time: '1h ago', unread: 0, avatar: '🏃' },
  { id: 'c3', name: '3-Day Screen-Free Dinner', lastMsg: 'Sarah K.: Amazing dinner tonight!', time: '3h ago', unread: 1, avatar: '🍽️' },
];

// ── Your Active Challenges ──
const activeChallenges = [
  { id: 'a1', title: '30-Day Push-Up Challenge', type: 'Strength', daysLeft: 18, totalDays: 30, progress: 0.4, points: 500, color: '#4F8EF7' },
  { id: 'a2', title: '7-Day Morning Run', type: 'Cardio', daysLeft: 4, totalDays: 7, progress: 0.57, points: 150, color: Colors.primary },
  { id: 'a3', title: '3-Day Screen-Free Dinner', type: 'Family', daysLeft: 1, totalDays: 3, progress: 0.67, points: 75, color: '#A855F7' },
];

// ── Completed Challenges ──
const completedChallenges = [
  { id: 'd1', title: '5-Day Meditation Reset', type: 'Mindfulness', earnedPoints: 100, completedDate: 'Mar 28', color: '#22C55E' },
  { id: 'd2', title: '14-Day Clean Eating', type: 'Nutrition', earnedPoints: 200, completedDate: 'Mar 12', color: '#F59E0B' },
];

// ── Ready to Start ──
const readyToStart = [
  { id: 'r1', title: '21-Day No Sugar Detox', description: 'Eliminate all added sugar for 21 days.', duration: '21 Days', type: 'Nutrition', points: 350, participants: 9, difficulty: 'ADVANCED', difficultyColor: '#EF4444' },
  { id: 'r2', title: '14-Day Clean Eating', description: 'Whole foods only — no processed snacks.', duration: '14 Days', type: 'Nutrition', points: 200, participants: 22, difficulty: 'INTERMEDIATE', difficultyColor: '#F59E0B' },
  { id: 'r3', title: '5-Day Meditation Reset', description: 'Meditate 10 minutes every day.', duration: '5 Days', type: 'Mindfulness', points: 100, participants: 18, difficulty: 'BEGINNER', difficultyColor: '#22C55E' },
];

// ── Community Posts ──
type CommunityPost = {
  id: string;
  author_name: string;
  author_role: string;
  author_profile_image: string;
  audience: string;
  content: string;
  image_url: string;
  like_count: number;
  comment_count: number;
  created_at: string;
  updated_at: string;
};
function formatCommunityPostTime(value: string) {
  const createdAt = new Date(value);
  if (Number.isNaN(createdAt.getTime())) {
    return '';
  }

  const diffMs = Date.now() - createdAt.getTime();
  const diffMinutes = Math.max(Math.floor(diffMs / 60000), 0);
  if (diffMinutes < 1) {
    return 'Just now';
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  return createdAt.toLocaleDateString();
}

export default function ChallengesScreen() {
  const [activeTab, setActiveTab] = useState('CHALLENGES');
  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>([]);
  const [communityDraft, setCommunityDraft] = useState('');
  const [communityLoading, setCommunityLoading] = useState(false);
  const [communityPosting, setCommunityPosting] = useState(false);
  const [communityError, setCommunityError] = useState('');

  useEffect(() => {
    if (activeTab !== 'COMMUNITY') {
      return;
    }

    let isMounted = true;

    const loadCommunityPosts = async () => {
      setCommunityLoading(true);
      setCommunityError('');
      try {
        const response = await apiRequest<{ posts: CommunityPost[] }>('/community/posts');
        if (isMounted) {
          setCommunityPosts(Array.isArray(response.posts) ? response.posts : []);
        }
      } catch (error) {
        if (isMounted) {
          setCommunityError(error instanceof Error ? error.message : 'Failed to load community posts');
        }
      } finally {
        if (isMounted) {
          setCommunityLoading(false);
        }
      }
    };

    loadCommunityPosts();

    return () => {
      isMounted = false;
    };
  }, [activeTab]);

  const handleCommunityPost = async () => {
    const content = communityDraft.trim();
    if (!content) {
      setCommunityError('Write something before posting.');
      return;
    }

    setCommunityPosting(true);
    setCommunityError('');
    try {
      const response = await apiRequest<CommunityPost>('/community/posts', {
        method: 'POST',
        body: {
          content,
        },
      });
      setCommunityDraft('');
      setCommunityPosts((current) => [response, ...current]);
    } catch (error) {
      setCommunityError(error instanceof Error ? error.message : 'Failed to publish post');
    } finally {
      setCommunityPosting(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* Brand Header */}
        <View style={styles.brandHeader}>
          <Text style={styles.brandTitle}>V I C T O R Y</Text>
          <Text style={styles.brandSubtitle}>F I T N E S S</Text>
        </View>

        {/* Tabs */}
        <View style={styles.tabRow}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── CHALLENGES TAB ── */}
        {activeTab === 'CHALLENGES' && (
          <View style={styles.section}>

            {/* ─ Active Challenge Chats ─ */}
            <View style={styles.subSectionHeader}>
              <Ionicons name="chatbubbles" size={16} color={Colors.primary} />
              <Text style={styles.subSectionTitle}>Active Challenge Chats</Text>
            </View>
            {activeChats.map((chat) => (
              <TouchableOpacity key={chat.id} style={styles.chatCard} activeOpacity={0.85}>
                <View style={styles.chatAvatarWrap}>
                  <Text style={styles.chatAvatarEmoji}>{chat.avatar}</Text>
                </View>
                <View style={styles.chatContent}>
                  <Text style={styles.chatName}>{chat.name}</Text>
                  <Text style={styles.chatLastMsg} numberOfLines={1}>{chat.lastMsg}</Text>
                </View>
                <View style={styles.chatRight}>
                  <Text style={styles.chatTime}>{chat.time}</Text>
                  {chat.unread > 0 && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadText}>{chat.unread}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ))}

            {/* ─ Your Active Challenges ─ */}
            <View style={[styles.subSectionHeader, { marginTop: 24 }]}>
              <Ionicons name="flash" size={16} color={Colors.primary} />
              <Text style={styles.subSectionTitle}>Your Active Challenges</Text>
            </View>
            {activeChallenges.map((ch) => (
              <View key={ch.id} style={styles.activeCard}>
                <View style={styles.activeCardTop}>
                  <View style={[styles.activeColorDot, { backgroundColor: ch.color }]} />
                  <Text style={styles.activeCardTitle}>{ch.title}</Text>
                  <View style={styles.activePointsBadge}>
                    <Ionicons name="star" size={11} color="#F59E0B" />
                    <Text style={styles.activePointsText}>+{ch.points}</Text>
                  </View>
                </View>
                <View style={styles.activeProgressRow}>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${ch.progress * 100}%` as any, backgroundColor: ch.color }]} />
                  </View>
                  <Text style={styles.progressLabel}>
                    {Math.round(ch.progress * ch.totalDays)}/{ch.totalDays} days
                  </Text>
                </View>
                <View style={styles.activeCardMeta}>
                  <Text style={styles.activeMetaText}>{ch.type}</Text>
                  <Text style={[styles.daysLeftText, { color: ch.daysLeft <= 2 ? '#EF4444' : Colors.textMuted }]}>
                    {ch.daysLeft} days left
                  </Text>
                </View>
              </View>
            ))}

            {/* ─ Completed ─ */}
            <View style={[styles.subSectionHeader, { marginTop: 24 }]}>
              <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
              <Text style={[styles.subSectionTitle, { color: '#22C55E' }]}>Completed</Text>
            </View>
            {completedChallenges.map((ch) => (
              <View key={ch.id} style={styles.completedCard}>
                <View style={[styles.completedIcon, { backgroundColor: `${ch.color}22` }]}>
                  <Ionicons name="trophy" size={20} color={ch.color} />
                </View>
                <View style={styles.completedInfo}>
                  <Text style={styles.completedTitle}>{ch.title}</Text>
                  <Text style={styles.completedMeta}>{ch.type} · {ch.completedDate}</Text>
                </View>
                <View style={styles.completedPts}>
                  <Ionicons name="star" size={12} color="#F59E0B" />
                  <Text style={styles.completedPtsText}>+{ch.earnedPoints} Pts</Text>
                </View>
              </View>
            ))}

            {/* ─ Ready to Start ─ */}
            <View style={[styles.subSectionHeader, { marginTop: 24 }]}>
              <Ionicons name="rocket" size={16} color="#4F8EF7" />
              <Text style={[styles.subSectionTitle, { color: '#4F8EF7' }]}>Ready to Start</Text>
            </View>
            {readyToStart.map((ch) => (
              <View key={ch.id} style={styles.readyCard}>
                <View style={styles.readyCardTop}>
                  <Text style={styles.readyTitle}>{ch.title}</Text>
                  <View style={[styles.difficultyBadge, { backgroundColor: `${ch.difficultyColor}22` }]}>
                    <Text style={[styles.difficultyText, { color: ch.difficultyColor }]}>{ch.difficulty}</Text>
                  </View>
                </View>
                <Text style={styles.readyDesc} numberOfLines={2}>{ch.description}</Text>
                <View style={styles.readyMeta}>
                  <View style={styles.metaItem}>
                    <Ionicons name="time-outline" size={12} color={Colors.textMuted} />
                    <Text style={styles.metaText}>{ch.duration}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Ionicons name="people-outline" size={12} color={Colors.textMuted} />
                    <Text style={styles.metaText}>{ch.participants} joined</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Ionicons name="star" size={12} color="#F59E0B" />
                    <Text style={[styles.metaText, { color: '#F59E0B' }]}>+{ch.points} Pts</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.startBtn} activeOpacity={0.85}>
                  <Text style={styles.startBtnText}>START CHALLENGE</Text>
                  <Ionicons name="arrow-forward" size={14} color="#000" />
                </TouchableOpacity>
              </View>
            ))}

          </View>
        )}


        {/* ── COMMUNITY TAB ── */}
        {activeTab === 'COMMUNITY' && (
          <View style={styles.section}>

            {/* Post Composer */}
            <View style={styles.composerCard}>
              <TextInput
                style={styles.composerInput}
                placeholder="What's on your mind?"
                placeholderTextColor="rgba(255,255,255,0.35)"
                multiline
                value={communityDraft}
                onChangeText={setCommunityDraft}
              />
              <View style={styles.composerDivider} />
              <View style={styles.composerActions}>
                <TouchableOpacity style={styles.composerImgBtn}>
                  <Ionicons name="image-outline" size={22} color="rgba(255,255,255,0.45)" />
                </TouchableOpacity>

                {/* Tier Dropdown */}
                {/* <View style={styles.tierDropdownWrapper}>
                  <TouchableOpacity
                    style={styles.tierSelector}
                    onPress={() => setTierDropdownOpen(!tierDropdownOpen)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.tierText}>{selectedTier}</Text>
                    <Ionicons
                      name={tierDropdownOpen ? 'chevron-up' : 'chevron-down'}
                      size={13}
                      color="rgba(255,255,255,0.6)"
                    />
                  </TouchableOpacity>
                  {tierDropdownOpen && (
                    <View style={styles.tierDropdown}>
                      {TIERS.map((tier) => (
                        <TouchableOpacity
                          key={tier}
                          style={[
                            styles.tierOption,
                            selectedTier === tier && styles.tierOptionActive,
                          ]}
                          onPress={() => {
                            setSelectedTier(tier);
                            setTierDropdownOpen(false);
                          }}
                        >
                          <Text style={[
                            styles.tierOptionText,
                            selectedTier === tier && styles.tierOptionTextActive,
                          ]}>
                            {tier}
                          </Text>
                          {selectedTier === tier && (
                            <Ionicons name="checkmark" size={14} color={Colors.primary} />
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View> */}

                <TouchableOpacity
                  style={[styles.postBtn, communityPosting && { opacity: 0.7 }]}
                  onPress={handleCommunityPost}
                  disabled={communityPosting}
                >
                  {communityPosting ? <ActivityIndicator size="small" color="#0A0A14" /> : <Text style={styles.postBtnText}>Post</Text>}
                </TouchableOpacity>
              </View>
            </View>

            {communityError ? (
              <View style={styles.communityErrorCard}>
                <Text style={styles.communityErrorText}>{communityError}</Text>
              </View>
            ) : null}

            {communityLoading ? (
              <View style={styles.communityLoadingWrap}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.communityLoadingText}>Loading community posts...</Text>
              </View>
            ) : null}

            {/* Community Posts */}
            {communityPosts.map((post) => (
              <View key={post.id} style={styles.postCard}>
                {/* Post Header */}
                <View style={styles.postHeader}>
                  <View style={styles.postAvatar}>
                    <Text style={styles.postAvatarText}>{(post.author_name || 'U')[0]}</Text>
                  </View>
                  <View style={styles.postMeta}>
                    <View style={styles.postMetaRow}>
                      <Text style={styles.postAuthor}>{post.author_name}</Text>
                      <Text style={styles.postTime}>{formatCommunityPostTime(post.created_at)}</Text>
                      <View style={[styles.tierBadge, { backgroundColor: post.audience === 'ALL' ? '#22C55E' : '#A855F7' }]}>
                        <Text style={styles.tierBadgeText}>{post.audience}</Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Post Body */}
                <Text style={styles.postBody}>{post.content}</Text>
                {post.image_url ? (
                  <Text style={styles.postImageLink}>{post.image_url}</Text>
                ) : null}

                {/* Post Footer */}
                <View style={styles.postFooter}>
                  <TouchableOpacity style={styles.postAction}>
                    <Ionicons name="thumbs-up-outline" size={16} color="rgba(255,255,255,0.5)" />
                    <Text style={styles.postActionText}>{post.like_count}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.postAction}>
                    <Ionicons name="chatbubble-outline" size={16} color="rgba(255,255,255,0.5)" />
                    <Text style={styles.postActionText}>{post.comment_count}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}

          </View>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingTop: 20,
    paddingBottom: 40,
  },

  /* Brand Header */
  brandHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 8,
    fontFamily: 'Inter_700Bold',
  },
  brandSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: 6,
    marginTop: 4,
    fontFamily: 'Inter_600SemiBold',
  },

  /* Page Title */
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 3,
    fontFamily: 'Inter_700Bold',
  },
  pageSubtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  inviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  inviteBtnText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },

  /* Tabs */
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 20,
    backgroundColor: '#1A1A2E',
    borderRadius: 14,
    padding: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabBtnActive: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.5,
    fontFamily: 'Inter_700Bold',
  },
  tabTextActive: {
    color: '#000',
  },

  /* Shared */
  section: {
    paddingHorizontal: 16,
  },

  /* Sub-section Header */
  subSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  subSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 0.5,
    fontFamily: 'Inter_700Bold',
  },

  /* Active Challenge Chats */
  chatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#13132A',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    gap: 12,
  },
  chatAvatarWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,240,208,0.1)',
    borderWidth: 1.5,
    borderColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatAvatarEmoji: {
    fontSize: 22,
  },
  chatContent: {
    flex: 1,
  },
  chatName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    marginBottom: 3,
  },
  chatLastMsg: {
    color: Colors.textMuted,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  chatRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  chatTime: {
    color: Colors.textMuted,
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  unreadBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  unreadText: {
    color: '#000',
    fontSize: 11,
    fontWeight: '800',
    fontFamily: 'Inter_700Bold',
  },

  /* Your Active Challenges */
  activeCard: {
    backgroundColor: '#13132A',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  activeCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  activeColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  activeCardTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  activePointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245,158,11,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  activePointsText: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  activeProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  progressBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    fontFamily: 'Inter_400Regular',
    minWidth: 50,
    textAlign: 'right',
  },
  activeCardMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  activeMetaText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontFamily: 'Inter_400Regular',
  },
  daysLeftText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },

  /* Completed */
  completedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#13132A',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.2)',
    gap: 12,
  },
  completedIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  completedInfo: {
    flex: 1,
  },
  completedTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    marginBottom: 3,
  },
  completedMeta: {
    color: Colors.textMuted,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  completedPts: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245,158,11,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  completedPtsText: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },

  /* Ready to Start */
  readyCard: {
    backgroundColor: '#13132A',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(79,142,247,0.2)',
  },
  readyCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
    gap: 8,
  },
  readyTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  readyDesc: {
    color: Colors.textMuted,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 19,
    marginBottom: 12,
  },
  readyMeta: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontFamily: 'Inter_400Regular',
  },
  difficultyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  difficultyText: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.3,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
  },
  startBtnText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '800',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.5,
  },


  /* Community */
  communityBanner: {
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  communityBannerCount: {
    fontSize: 36,
    fontWeight: '800',
    color: '#fff',
    fontFamily: 'Inter_700Bold',
    marginTop: 8,
  },
  communityBannerLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    fontFamily: 'Inter_400Regular',
    marginBottom: 16,
  },
  communityInviteBtn: {
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
  },
  communityInviteBtnText: {
    color: '#3730A3',
    fontSize: 14,
    fontWeight: '800',
    fontFamily: 'Inter_700Bold',
  },
  feedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#13132A',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 12,
  },
  feedAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  feedAvatarText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '800',
    fontFamily: 'Inter_700Bold',
  },
  feedContent: {
    flex: 1,
  },
  feedText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
  },
  feedUser: {
    color: '#fff',
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  feedTime: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 3,
    fontFamily: 'Inter_400Regular',
  },
  feedPts: {
    backgroundColor: 'rgba(245,158,11,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  feedPtsText: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  /* Community Composer */
  composerCard: {
    backgroundColor: '#13132A',
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  searchInput: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    paddingVertical: 12,
    outlineStyle: 'none' as any,
  },
  composerInput: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    padding: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  composerDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: 0,
  },
  composerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  composerImgBtn: {
    padding: 6,
  },
  tierSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  tierText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  postBtn: {
    marginLeft: 'auto',
    backgroundColor: '#fff',
    paddingHorizontal: 22,
    paddingVertical: 8,
    borderRadius: 10,
  },
  postBtnText: {
    color: '#0A0A14',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  communityErrorCard: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
    padding: 12,
    marginBottom: 12,
  },
  communityErrorText: {
    color: '#FCA5A5',
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
  },
  communityLoadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  communityLoadingText: {
    color: Colors.textMuted,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },

  /* Post Card */
  postCard: {
    backgroundColor: '#13132A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  postAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  postAvatarText: {
    color: '#000',
    fontSize: 18,
    fontWeight: '800',
    fontFamily: 'Inter_700Bold',
  },
  postMeta: {
    flex: 1,
  },
  postMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  postAuthor: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  postTime: {
    color: Colors.textMuted,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  tierBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: 'auto',
  },
  tierBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.5,
  },
  postBody: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    lineHeight: 22,
    marginBottom: 14,
  },
  postImageLink: {
    color: Colors.primary,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginBottom: 14,
  },
  postFooter: {
    flexDirection: 'row',
    gap: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingTop: 12,
  },
  postAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  postActionText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },

  /* Tier Dropdown */
  tierDropdownWrapper: {
    position: 'relative',
  },
  tierDropdown: {
    position: 'absolute',
    top: 40,
    left: 0,
    backgroundColor: '#1E1E38',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    zIndex: 999,
    minWidth: 160,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
    overflow: 'hidden',
  },
  tierOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  tierOptionActive: {
    backgroundColor: 'rgba(0,240,208,0.08)',
  },
  tierOptionText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  tierOptionTextActive: {
    color: Colors.primary,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
});
