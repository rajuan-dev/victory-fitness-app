import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { ErrorPopupModal } from '../../components/ErrorPopupModal';
import { apiRequest } from '../../lib/api';
import { formatAppError } from '../../lib/error';
import { useModuleAccessGuard } from '../../lib/useModuleAccessGuard';

interface Message {
  id: string;
  text: string;
  sender: 'coach' | 'user';
}

type ChatHistoryItem = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
};

const INITIAL_MESSAGES: Message[] = [
  {
    id: '1',
    text: "Hi Admin! I'm Coach Victor. How can I help you with your fitness journey today?",
    sender: 'coach',
  },
];

const MessageBubble = memo(function MessageBubble({ item }: { item: Message }) {
  const isCoach = item.sender === 'coach';
  const coachContent = useMemo(() => {
    if (!isCoach) {
      return null;
    }

    return renderCoachMessage(item.text);
  }, [isCoach, item.text]);

  return (
    <View
      style={[
        styles.messageContainer,
        isCoach ? styles.coachContainer : styles.userContainer,
      ]}
    >
      <View
        style={[
          styles.bubble,
          isCoach ? styles.coachBubble : styles.userBubble,
        ]}
      >
        {isCoach ? coachContent : (
          <Text style={[styles.messageText, styles.userText]}>{item.text}</Text>
        )}
      </View>
    </View>
  );
});

export default function ChatScreen() {
  const checkingAccess = useModuleAccessGuard('/chat');
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [errorDialog, setErrorDialog] = useState<{ title: string; message: string } | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadHistory = async () => {
      setLoadingHistory(true);
      try {
        const response = await apiRequest<{ messages: ChatHistoryItem[] }>('/ai/coach-victor/history');
        if (cancelled) {
          return;
        }

        const mapped: Message[] = response.messages.map((item) => ({
          id: item.id,
          text: item.content,
          sender: item.role === 'assistant' ? 'coach' : 'user',
        }));

        setMessages(mapped.length > 0 ? mapped : INITIAL_MESSAGES);
      } catch (error) {
        if (!cancelled) {
          setMessages(INITIAL_MESSAGES);
          setErrorDialog(formatAppError(error));
        }
      } finally {
        if (!cancelled) {
          setLoadingHistory(false);
        }
      }
    };

    void loadHistory();

    return () => {
      cancelled = true;
    };
  }, []);

  const sendMessage = async () => {
    const trimmed = inputText.trim();
    if (!trimmed || sending) {
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      text: trimmed,
      sender: 'user',
    };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInputText('');
    setSending(true);

    try {
      const response = await apiRequest<{ reply: string }>('/ai/coach-victor/chat', {
        method: 'POST',
        body: { message: trimmed },
      });

      const coachMessage: Message = {
        id: `${Date.now()}-coach`,
        text: response.reply,
        sender: 'coach',
      };
      setMessages((current) => [...current, coachMessage]);
    } catch (error) {
      setErrorDialog(formatAppError(error, 'Coach Victor is unavailable right now. Please try again in a moment.'));
    } finally {
      setSending(false);
    }
  };

  const renderMessage = useCallback(
    ({ item }: { item: Message }) => <MessageBubble item={item} />,
    []
  );

  const keyExtractor = useCallback((item: Message) => item.id, []);

  if (checkingAccess) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.historyLoading}>
          <ActivityIndicator color={Colors.accentBlue} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ErrorPopupModal
        visible={Boolean(errorDialog)}
        title={errorDialog?.title ?? 'Error'}
        message={errorDialog?.message ?? ''}
        onClose={() => setErrorDialog(null)}
      />
      
      {/* Custom Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerIcon}>
          <Ionicons name="add" size={24} color="#fff" style={{ transform: [{ rotate: '45deg' }] }} />
        </TouchableOpacity>
        
        <View style={styles.headerContent}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatarOuter}>
              <View style={styles.avatarInner}>
                <Ionicons name="add" size={16} color="#fff" />
              </View>
            </View>
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>COACH VICTOR</Text>
            <View style={styles.statusRow}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>ONLINE & READY</Text>
            </View>
          </View>
        </View>

        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <FlatList
          data={messages}
          renderItem={renderMessage}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={50}
          windowSize={7}
          removeClippedSubviews={Platform.OS === 'android'}
        />
        {loadingHistory && (
          <View style={styles.historyLoading}>
            <ActivityIndicator color={Colors.accentBlue} />
          </View>
        )}

        {/* Input Bar */}
        <View style={styles.inputBar}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Ask me anything..."
              placeholderTextColor="rgba(255, 255, 255, 0.4)"
              value={inputText}
              onChangeText={setInputText}
              multiline
              editable={!sending}
            />
            <TouchableOpacity onPress={sendMessage} style={styles.sendButton} disabled={sending}>
              {sending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function renderCoachMessage(text: string) {
  const lines = text.split(/\r?\n/);

  return (
    <View>
      {lines.map((line, index) => {
        const trimmed = line.trim();

        if (!trimmed) {
          return <View key={index} style={styles.markdownGap} />;
        }

        if (trimmed === '---') {
          return <View key={index} style={styles.markdownDivider} />;
        }

        const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
        if (heading) {
          const level = heading[1].length;
          return (
            <Text
              key={index}
              style={[
                styles.markdownHeading,
                level === 1 && styles.markdownHeadingOne,
                level === 2 && styles.markdownHeadingTwo,
              ]}
            >
              {renderInlineMarkdown(heading[2], `heading-${index}`)}
            </Text>
          );
        }

        const bullet = trimmed.match(/^[-*]\s+(.+)$/);
        if (bullet) {
          return (
            <View key={index} style={styles.markdownListRow}>
              <Text style={styles.markdownListMarker}>•</Text>
              <Text style={styles.markdownText}>{renderInlineMarkdown(bullet[1], `bullet-${index}`)}</Text>
            </View>
          );
        }

        const numbered = trimmed.match(/^(\d+)\.\s+(.+)$/);
        if (numbered) {
          return (
            <View key={index} style={styles.markdownListRow}>
              <Text style={styles.markdownNumberMarker}>{numbered[1]}.</Text>
              <Text style={styles.markdownText}>{renderInlineMarkdown(numbered[2], `number-${index}`)}</Text>
            </View>
          );
        }

        return (
          <Text key={index} style={styles.markdownText}>
            {renderInlineMarkdown(trimmed, `text-${index}`)}
          </Text>
        );
      })}
    </View>
  );
}

function renderInlineMarkdown(text: string, keyPrefix: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <Text key={`${keyPrefix}-${index}`} style={styles.markdownBold}>
          {part.slice(2, -2)}
        </Text>
      );
    }

    return <Text key={`${keyPrefix}-${index}`}>{part}</Text>;
  });
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  headerIcon: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarContainer: {
    marginRight: 10,
  },
  avatarOuter: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.accentBlue,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.accentBlue,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 5,
  },
  avatarInner: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTextContainer: {
    alignItems: 'flex-start',
  },
  headerTitle: {
    color: Colors.accentBlue,
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#4ade80',
    marginRight: 4,
  },
  statusText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 10,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  messageContainer: {
    marginBottom: 16,
    maxWidth: '85%',
  },
  coachContainer: {
    alignSelf: 'flex-start',
  },
  userContainer: {
    alignSelf: 'flex-end',
  },
  bubble: {
    padding: 14,
    borderRadius: 16,
  },
  coachBubble: {
    backgroundColor: '#1E2530',
    borderBottomLeftRadius: 4,
  },
  userBubble: {
    backgroundColor: Colors.accentBlue,
    borderBottomRightRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: 'Inter_400Regular',
  },
  coachText: {
    color: '#D1D5DB',
  },
  userText: {
    color: '#000',
  },
  markdownText: {
    color: '#D1D5DB',
    fontSize: 15,
    lineHeight: 22,
    fontFamily: 'Inter_400Regular',
    marginBottom: 8,
  },
  markdownBold: {
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
  },
  markdownHeading: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 22,
    fontFamily: 'Inter_700Bold',
    marginTop: 8,
    marginBottom: 8,
  },
  markdownHeadingOne: {
    fontSize: 18,
    lineHeight: 24,
    marginTop: 0,
  },
  markdownHeadingTwo: {
    fontSize: 17,
    lineHeight: 23,
  },
  markdownListRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  markdownListMarker: {
    color: Colors.accentBlue,
    fontSize: 15,
    lineHeight: 22,
    width: 18,
    fontFamily: 'Inter_700Bold',
  },
  markdownNumberMarker: {
    color: Colors.accentBlue,
    fontSize: 15,
    lineHeight: 22,
    minWidth: 26,
    fontFamily: 'Inter_700Bold',
  },
  markdownGap: {
    height: 6,
  },
  markdownDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginVertical: 10,
  },
  inputBar: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  historyLoading: {
    position: 'absolute',
    top: 70,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E2530',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    maxHeight: 120,
    paddingTop: 8,
    paddingBottom: 8,
    fontFamily: 'Inter_400Regular',
    outlineStyle: 'none' as any,
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
});


