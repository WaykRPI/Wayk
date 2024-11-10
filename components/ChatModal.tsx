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
} from 'react-native';
import { Modalize } from 'react-native-modalize';
import { supabase } from '../app/lib/supabase';

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  read: boolean;
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
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${selectedUser.user_id}),and(sender_id.eq.${selectedUser.user_id},receiver_id.eq.${currentUser.id})`)
        .order('created_at', { ascending: true });

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

    const { error } = await supabase.from('messages').insert([message]);

    if (!error) {
      setNewMessage('');
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isOwnMessage = item.sender_id === currentUser?.id;

    return (
      <View
        style={[
          styles.messageContainer,
          isOwnMessage ? styles.ownMessage : styles.otherMessage,
        ]}
      >
        <Text style={styles.messageText}>{item.content}</Text>
        <Text style={styles.messageTime}>
          {new Date(item.created_at).toLocaleTimeString()}
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={styles.headerText}>
          Chat with {selectedUser?.user_email?.split('@')[0]}
        </Text>
      </View>
      
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        style={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
        onLayout={() => flatListRef.current?.scrollToEnd()}
      />

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={newMessage}
          onChangeText={setNewMessage}
          placeholder="Type a message..."
          multiline
        />
        <Pressable style={styles.sendButton} onPress={sendMessage}>
          <Text style={styles.sendButtonText}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    maxHeight: 500,
  },
  header: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  headerText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0ea5e9',
  },
  messagesList: {
    flex: 1,
    padding: 10,
  },
  messageContainer: {
    maxWidth: '80%',
    marginVertical: 5,
    padding: 10,
    borderRadius: 10,
  },
  ownMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#0ea5e9',
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#e5e5e5',
  },
  messageText: {
    color: '#fff',
    fontSize: 16,
  },
  messageTime: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 5,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginRight: 10,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#0ea5e9',
    borderRadius: 20,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
