import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { Modalize } from 'react-native-modalize';
import { supabase } from '../app/lib/supabase';
import { Send, X } from 'lucide-react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
}

interface ChatModalProps {
  modalizeRef: React.RefObject<Modalize>;
  currentUser: any;
  selectedUser: any;
  onClose: () => void;
}

export const ChatModal: React.FC<ChatModalProps> = ({
  modalizeRef,
  currentUser,
  selectedUser,
  onClose,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!currentUser || !selectedUser) return;

    // Fetch existing messages
    const fetchMessages = async () => {
      console.log('Fetching messages for:', currentUser.id, selectedUser.user_id);
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(
          `and(sender_id.eq.${currentUser.id},receiver_id.eq.${selectedUser.user_id}),` +
          `and(sender_id.eq.${selectedUser.user_id},receiver_id.eq.${currentUser.id})`
        )
        .order('created_at', { ascending: true });

      console.log('Messages received:', data);
      if (error) console.log('Error fetching messages:', error);

      if (data && !error) {
        setMessages(data);
      }
    };

    fetchMessages();

    // Subscribe to new messages
    const subscription = supabase
      .channel('messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `or(and(sender_id=eq.${currentUser.id},receiver_id=eq.${selectedUser.user_id}),and(sender_id=eq.${selectedUser.user_id},receiver_id=eq.${currentUser.id}))`,
        },
        (payload) => {
          setMessages((current) => [...current, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [currentUser, selectedUser]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !currentUser || !selectedUser) return;

    const message = {
      sender_id: currentUser.id,
      receiver_id: selectedUser.user_id,
      content: newMessage.trim(),
    };

    console.log('Sending message:', message);
    const { error } = await supabase.from('messages').insert([message]);

    if (error) {
      console.log('Error sending message:', error);
    } else {
      setNewMessage('');
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    }
    
    if (date.getFullYear() === now.getFullYear()) {
      return date.toLocaleDateString([], { 
        month: 'short', 
        day: 'numeric' 
      });
    }
    
    return date.toLocaleDateString([], { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const renderItem = ({ item, index }: { item: Message, index: number }) => {
    const isOwnMessage = item.sender_id === currentUser?.id;
    const showDate = index === 0 || 
      new Date(messages[index - 1].created_at).toDateString() !== 
      new Date(item.created_at).toDateString();

    return (
      <View key={item.id}>
        {showDate && (
          <View style={styles.dateContainer}>
            <Text style={styles.dateText}>
              {new Date(item.created_at).toLocaleDateString([], {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </Text>
          </View>
        )}
        <View
          style={[
            styles.messageContainer,
            isOwnMessage ? styles.ownMessage : styles.otherMessage,
          ]}
        >
          <Text style={[
            styles.messageText,
            isOwnMessage ? styles.ownMessageText : styles.otherMessageText,
          ]}>
            {item.content}
          </Text>
          <Text style={[
            styles.messageTime,
            isOwnMessage ? styles.ownMessageTime : styles.otherMessageTime,
          ]}>
            {formatTime(item.created_at)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>
          Chat with {selectedUser?.user_email?.split('@')[0]}
        </Text>
        <Pressable onPress={onClose} style={styles.closeButton}>
          <X size={24} color="#0ea5e9" />
        </Pressable>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.chatContainer}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesContent}
          inverted={false}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder="Type a message..."
            multiline
            maxLength={500}
          />
          <Pressable 
            style={[styles.sendButton, !newMessage.trim() && styles.sendButtonDisabled]} 
            onPress={sendMessage}
            disabled={!newMessage.trim()}
          >
            <Send size={20} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: SCREEN_HEIGHT * 0.9,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  headerText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0ea5e9',
  },
  closeButton: {
    padding: 5,
  },
  chatContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 10,
    flexGrow: 1,
  },
  dateContainer: {
    alignItems: 'center',
    marginVertical: 10,
  },
  dateText: {
    color: '#6b7280',
    fontSize: 12,
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  messageContainer: {
    maxWidth: '80%',
    marginVertical: 5,
    padding: 12,
    borderRadius: 16,
  },
  ownMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#0ea5e9',
    borderBottomRightRadius: 4,
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#f3f4f6',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  ownMessageText: {
    color: '#fff',
  },
  otherMessageText: {
    color: '#1f2937',
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
  },
  ownMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  otherMessageTime: {
    color: '#6b7280',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    maxHeight: 100,
    backgroundColor: '#f9fafb',
  },
  sendButton: {
    backgroundColor: '#0ea5e9',
    borderRadius: 24,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#93c5fd',
  },
});