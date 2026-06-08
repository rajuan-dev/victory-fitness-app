import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  Pressable,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { ErrorPopupModal } from '../../components/ErrorPopupModal';
import { apiRequest } from '../../lib/api';
import { formatAppError } from '../../lib/error';
import { useLanguage } from '../../lib/i18n';
import { ScreenState } from '../../components/ScreenState';
import { useAsyncScreenData } from '../../hooks/useAsyncScreenData';
import { fetchJournalEntries, JOURNAL_ENTRIES_CACHE_KEY, JournalEntry } from '../../lib/screenData';
import { primeCachedResource } from '../../lib/resourceCache';

const MOOD_EMOJI: Record<string, string> = {
  ANGRY: '\u{1F621}',
  ANXIOUS: '\u{1F61F}',
  NEUTRAL: '\u{1F610}',
  GOOD: '\u{1F60A}',
  VICTORIOUS: '\u{1F929}',
};

type FormattedJournalBlock =
  | { type: 'bullet'; content: string }
  | { type: 'section'; title: string; content: string }
  | { type: 'paragraph'; content: string };

function formatEntryDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'UNKNOWN DATE';
  }

  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).toUpperCase();
}

function formatEntryTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatJournalContent(content: string): FormattedJournalBlock[] {
  const normalized = content
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (!normalized.length) {
    return [];
  }

  const blocks: FormattedJournalBlock[] = [];

  normalized.forEach((line) => {
    const sectionMatch = line.match(/^\*\*(.+?)\*\*\s*:?\s*(.*)$/);
    if (sectionMatch) {
      const rawTitle = sectionMatch[1].trim().replace(/:$/, '');
      const sectionContent = sectionMatch[2].trim();
      blocks.push({
        type: 'section',
        title: rawTitle,
        content: sectionContent,
      });
      return;
    }

    const bulletMatch = line.match(/^([-*\u2022]|\d+[.)])\s+(.*)$/);
    if (bulletMatch) {
      blocks.push({ type: 'bullet', content: bulletMatch[2].trim() });
      return;
    }

    const sentenceChunks = line
      .split(/(?<=[.!?])\s+/)
      .map((part) => part.trim())
      .filter(Boolean);

    if (sentenceChunks.length <= 2) {
      blocks.push({ type: 'paragraph', content: line });
      return;
    }

    for (let i = 0; i < sentenceChunks.length; i += 2) {
      blocks.push({
        type: 'paragraph',
        content: sentenceChunks.slice(i, i + 2).join(' '),
      });
    }
  });

  return blocks;
}

export default function JournalHistoryScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [errorDialog, setErrorDialog] = useState<{ title: string; message: string } | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<JournalEntry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const {
    data: journalData,
    loading,
    refreshing,
    error,
    reload,
    setData,
  } = useAsyncScreenData({
    initialData: { entries: [] as JournalEntry[] },
    cacheKey: JOURNAL_ENTRIES_CACHE_KEY,
    load: fetchJournalEntries,
    getErrorMessage: (loadError) => formatAppError(loadError, t('Unable to load journal history right now.')).message,
  });
  const entries = journalData.entries;
  const formattedSelectedEntry = selectedEntry ? formatJournalContent(selectedEntry.content) : [];

  const handleBackPress = useCallback(() => {
    setSelectedEntry(null);
    setDeleteTarget(null);
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/journal');
  }, [router]);

  const handleDeleteEntry = useCallback(async () => {
    if (!deleteTarget || deleting) {
      return;
    }

    setDeleting(true);
    setErrorDialog(null);
    try {
      await apiRequest(`/journal/entries/${encodeURIComponent(deleteTarget.id)}`, {
        method: 'DELETE',
      });
      const nextEntries = entries.filter((item) => item.id !== deleteTarget.id);
      setData({ entries: nextEntries });
      await primeCachedResource(JOURNAL_ENTRIES_CACHE_KEY, { entries: nextEntries }, true);
      setSelectedEntry(null);
      setDeleteTarget(null);
    } catch (deleteError) {
      setErrorDialog(formatAppError(deleteError, t('Unable to delete this journal entry right now.')));
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, deleting, entries, setData, t]);

  const renderItem = ({ item }: { item: JournalEntry }) => {
    const moodEmoji = MOOD_EMOJI[item.mood] ?? '\u{1F4DD}';
    const previewBlocks = formatJournalContent(item.content).slice(0, 2);

    return (
      <TouchableOpacity
        style={styles.entryCard}
        activeOpacity={0.7}
        onPress={() => setSelectedEntry(item)}
      >
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.dateText}>{formatEntryDate(item.created_at)}</Text>
            <Text style={styles.timeText}>{formatEntryTime(item.created_at)}</Text>
          </View>
          <Text style={styles.moodEmoji}>{moodEmoji}</Text>
        </View>
        <View style={styles.entryPreview}>
          {previewBlocks.map((block, index) =>
            block.type === 'bullet' ? (
              <View key={`${item.id}-${block.type}-${index}`} style={styles.previewBulletRow}>
                <View style={styles.previewBulletDot} />
                <Text style={styles.entryText} numberOfLines={2}>
                  {block.content}
                </Text>
              </View>
            ) : block.type === 'section' ? (
              <View key={`${item.id}-${block.type}-${index}`} style={styles.previewSection}>
                <Text style={styles.previewSectionTitle}>{block.title}</Text>
                <Text style={styles.entryText} numberOfLines={2}>
                  {block.content}
                </Text>
              </View>
            ) : (
              <Text key={`${item.id}-${block.type}-${index}`} style={styles.entryText} numberOfLines={2}>
                {block.content}
              </Text>
            )
          )}
        </View>
        <View style={styles.cardFooter}>
          <Text style={styles.viewMoreText}>{t('View entry')}</Text>
          <Ionicons name="chevron-forward" size={14} color={Colors.accentBlue} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ErrorPopupModal
        visible={Boolean(errorDialog)}
        title={errorDialog?.title ?? t('Error')}
        message={errorDialog?.message ?? ''}
        onClose={() => setErrorDialog(null)}
      />
      <Modal
        visible={Boolean(selectedEntry)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedEntry(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedEntry(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleWrap}>
                <Text style={styles.modalDateText}>
                  {selectedEntry ? formatEntryDate(selectedEntry.created_at) : ''}
                </Text>
                <Text style={styles.modalTimeText}>
                  {selectedEntry ? formatEntryTime(selectedEntry.created_at) : ''}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedEntry(null)} style={styles.modalCloseButton}>
                <Ionicons name="close" size={22} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalMoodRow}>
              <Text style={styles.modalMoodEmoji}>
                {selectedEntry ? MOOD_EMOJI[selectedEntry.mood] ?? '\u{1F4DD}' : ''}
              </Text>
              <Text style={styles.modalMoodLabel}>{selectedEntry?.mood ?? ''}</Text>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {formattedSelectedEntry.map((block, index) =>
                block.type === 'bullet' ? (
                  <View key={`${block.type}-${index}`} style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.modalEntryText}>{block.content}</Text>
                  </View>
                ) : block.type === 'section' ? (
                  <View key={`${block.type}-${index}`} style={styles.sectionBlock}>
                    <Text style={styles.sectionTitle}>{block.title}</Text>
                    {!!block.content && <Text style={styles.modalEntryText}>{block.content}</Text>}
                  </View>
                ) : (
                  <Text key={`${block.type}-${index}`} style={styles.modalEntryText}>
                    {block.content}
                  </Text>
                )
              )}
            </ScrollView>
            <TouchableOpacity
              style={[styles.deleteButton, deleting && styles.deleteButtonDisabled]}
              activeOpacity={0.85}
              onPress={() => {
                if (selectedEntry && !deleting) {
                  setDeleteTarget(selectedEntry);
                }
              }}
              disabled={deleting}
            >
              <Ionicons name="trash-outline" size={18} color="#F87171" />
              <Text style={styles.deleteButtonText}>{t('Delete Journal')}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
      <Modal
        visible={Boolean(deleteTarget)}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!deleting) {
            setDeleteTarget(null);
          }
        }}
      >
        <View style={styles.confirmOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              if (!deleting) {
                setDeleteTarget(null);
              }
            }}
          />
          <View style={styles.confirmCard}>
            <View style={styles.confirmIconWrap}>
              <Ionicons name="trash-outline" size={24} color="#F87171" />
            </View>
            <Text style={styles.confirmTitle}>{t('Delete journal entry?')}</Text>
            <Text style={styles.confirmText}>{t('This will permanently remove the selected journal entry from your history.')}</Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.confirmCancelButton}
                activeOpacity={0.85}
                onPress={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                <Text style={styles.confirmCancelText}>{t('Cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmDeleteButton, deleting && styles.deleteButtonDisabled]}
                activeOpacity={0.85}
                onPress={() => {
                  void handleDeleteEntry();
                }}
                disabled={deleting}
              >
                {deleting ? (
                  <Ionicons name="hourglass-outline" size={18} color="#fff" />
                ) : (
                  <Text style={styles.confirmDeleteText}>{t('Delete')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      <View style={styles.screenHeader}>
        <TouchableOpacity onPress={handleBackPress} style={styles.backButton} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.screenTitle}>{t('JOURNAL HISTORY')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <ScreenState mode="loading" message={t('Loading saved journal entries...')} />
      ) : error ? (
        <ScreenState
          mode="error"
          message={error}
          actionLabel={t('Try Again')}
          onAction={() => {
            void reload().catch((loadError) => {
              setErrorDialog(formatAppError(loadError, t('Unable to load journal history right now.')));
            });
          }}
        />
      ) : (
        <FlatList
          data={entries}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={<View style={{ height: 100 }} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={34} color="rgba(255,255,255,0.25)" />
               <Text style={styles.emptyTitle}>{t('No journal entries yet')}</Text>
               <Text style={styles.emptyText}>{t('Save a journal entry to see it here.')}</Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                void reload().catch((loadError) => {
                  setErrorDialog(formatAppError(loadError, t('Unable to load journal history right now.')));
                });
              }}
              tintColor={Colors.accentBlue}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#131313',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    flexGrow: 1,
  },
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenTitle: {
    color: '#fff',
    fontSize: 16,
    letterSpacing: 2,
    fontFamily: 'Inter_700Bold',
  },
  headerSpacer: {
    width: 44,
    height: 44,
  },
  emptyState: {
    flex: 1,
    minHeight: 280,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1A1A1A',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 24,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
  entryCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  dateText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1,
  },
  timeText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  moodEmoji: {
    fontSize: 32,
  },
  entryText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
    lineHeight: 22,
    fontFamily: 'Inter_400Regular',
  },
  entryPreview: {
    marginBottom: 16,
  },
  previewBulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  previewBulletDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Colors.accentBlue,
    marginTop: 9,
  },
  previewSection: {
    marginBottom: 4,
  },
  previewSectionTitle: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.6,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
    paddingTop: 12,
  },
  viewMoreText: {
    color: Colors.accentBlue,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    marginRight: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    maxHeight: '80%',
    backgroundColor: '#1A1A1A',
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  modalTitleWrap: {
    flex: 1,
    paddingRight: 12,
  },
  modalDateText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1,
  },
  modalTimeText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    marginTop: 4,
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalMoodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  modalMoodEmoji: {
    fontSize: 28,
  },
  modalMoodLabel: {
    color: Colors.accentBlue,
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.2,
  },
  modalBody: {
    maxHeight: 380,
  },
  deleteButton: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.28)',
    backgroundColor: 'rgba(248,113,113,0.08)',
  },
  deleteButtonDisabled: {
    opacity: 0.55,
  },
  deleteButtonText: {
    color: '#F87171',
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
  modalEntryText: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 16,
    lineHeight: 25,
    fontFamily: 'Inter_400Regular',
    paddingBottom: 12,
  },
  sectionBlock: {
    paddingBottom: 6,
  },
  sectionTitle: {
    color: Colors.accentBlue,
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingBottom: 4,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accentBlue,
    marginTop: 10,
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#101827',
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  confirmIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignSelf: 'center',
    backgroundColor: 'rgba(248,113,113,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  confirmTitle: {
    color: '#fff',
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  confirmText: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    marginBottom: 18,
  },
  confirmActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  confirmCancelButton: {
    minWidth: 110,
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  confirmCancelText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
  confirmDeleteButton: {
    minWidth: 110,
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#DC2626',
  },
  confirmDeleteText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
});
