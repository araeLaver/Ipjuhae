/**
 * ChatRoom Screen — real-time conversation
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { apiClient } from '../services/apiClient';
import { Message } from '../types';
import { useAuth } from '../contexts/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'ChatRoom'>;

const ChatRoomScreen: React.FC<Props> = ({ route }) => {
  const { conversationId } = route.params;
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadMessages = useCallback(async () => {
    try {
      const data = await apiClient.get<Message[]>(`/messages/${conversationId}`);
      setMessages(data);
    } catch (error) {
      console.log('Failed to load messages:', error);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    loadMessages();
    // Poll for new messages every 5 seconds
    pollRef.current = setInterval(loadMessages, 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [loadMessages]);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || sending) return;

    setSending(true);
    setInputText('');

    try {
      const newMsg = await apiClient.post<Message>('/messages', {
        conversationId,
        content: text,
      });
      setMessages(prev => [...prev, newMsg]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (error) {
      console.log('Failed to send message:', error);
      setInputText(text); // Restore text on failure
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDateHeader = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return '오늘';
    if (date.toDateString() === yesterday.toDateString()) return '어제';
    return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const shouldShowDateHeader = (index: number) => {
    if (index === 0) return true;
    const current = new Date(messages[index].createdAt).toDateString();
    const previous = new Date(messages[index - 1].createdAt).toDateString();
    return current !== previous;
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMine = item.senderId === user?.id;
    const showDate = shouldShowDateHeader(index);

    return (
      <View>
        {showDate && (
          <View style={styles.dateHeader}>
            <Text style={styles.dateHeaderText}>{formatDateHeader(item.createdAt)}</Text>
          </View>
        )}
        <View style={[styles.messageBubbleRow, isMine && styles.messageBubbleRowMine]}>
          <View style={[styles.messageBubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
            <Text style={[styles.messageText, isMine && styles.messageTextMine]}>
              {item.content}
            </Text>
          </View>
          <Text style={[styles.timeText, isMine && styles.timeTextMine]}>
            {formatTime(item.createdAt)}
            {isMine && item.isRead && ' ✓'}
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderMessage}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyText}>대화를 시작해보세요</Text>
          </View>
        }
      />
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={inputText}
          onChangeText={setInputText}
          placeholder="메시지를 입력하세요"
          placeholderTextColor="#9CA3AF"
          multiline
          maxLength={1000}
          returnKeyType="send"
          onSubmitEditing={handleSend}
          blurOnSubmit={false}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!inputText.trim() || sending) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!inputText.trim() || sending}
        >
          <Text style={styles.sendButtonText}>{sending ? '...' : '전송'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  messageList: { padding: 16, paddingBottom: 8 },
  dateHeader: { alignItems: 'center', marginVertical: 12 },
  dateHeaderText: { fontSize: 12, color: '#9CA3AF', backgroundColor: '#F3F4F6', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  messageBubbleRow: { marginBottom: 8, alignItems: 'flex-start' },
  messageBubbleRowMine: { alignItems: 'flex-end' },
  messageBubble: { maxWidth: '75%', padding: 12, borderRadius: 16 },
  bubbleOther: { backgroundColor: '#fff', borderBottomLeftRadius: 4, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  bubbleMine: { backgroundColor: '#2563EB', borderBottomRightRadius: 4 },
  messageText: { fontSize: 15, color: '#111827', lineHeight: 20 },
  messageTextMine: { color: '#fff' },
  timeText: { fontSize: 11, color: '#9CA3AF', marginTop: 4, marginLeft: 4 },
  timeTextMine: { marginRight: 4, marginLeft: 0 },
  inputContainer: { flexDirection: 'row', alignItems: 'flex-end', padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  textInput: { flex: 1, maxHeight: 100, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#F3F4F6', borderRadius: 20, fontSize: 15, color: '#111827' },
  sendButton: { marginLeft: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#2563EB', borderRadius: 20 },
  sendButtonDisabled: { backgroundColor: '#93C5FD' },
  sendButtonText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  emptyContainer: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: '#9CA3AF' },
});

export default ChatRoomScreen;
