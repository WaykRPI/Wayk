import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Modalize } from 'react-native-modalize';
import { X, Send } from 'lucide-react-native';

const GEN_AI_KEY = process.env.EXPO_PUBLIC_GEN_AI_KEY;

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

// Update the props interface to include location
interface AIChatModalProps {
  modalizeRef: React.RefObject<Modalize>;
  reports: any[];
  onClose: () => void;
  userLocation?: { 
    latitude: number;
    longitude: number;
  };
}

export const AIChatModal: React.FC<AIChatModalProps> = ({
  modalizeRef,
  reports,
  onClose,
  userLocation,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const sendMessage = async () => {
    if (!inputMessage.trim() || !GEN_AI_KEY) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputMessage.trim(),
      sender: 'user',
      timestamp: new Date(),
    };

    console.log('User:', userMessage.content); // Log user message

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const headers = {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEN_AI_KEY,
      };

      const reportsContext = reports.map(report => ({
        type: report.type,
        description: report.description,
        accuracy_score: report.accuracy_score,
        ai_analysis: report.ai_analysis,
        latitude: report.latitude,
        longitude: report.longitude,
      }));

      const payload = {
        contents: [{
          parts: [{
            text: `You are a helpful AI assistant for WayK, a walking navigation app. You have access to the following context:

            User's current location: ${JSON.stringify(userLocation || 'Unknown')}
            
            Reports in the area:
            ${JSON.stringify(reportsContext, null, 2)}
            
            Previous messages in this conversation:
            ${messages.map(m => `${m.sender}: ${m.content}`).join('\n')}
            
            User question: ${inputMessage}
            
            Please provide helpful information about the reports, navigation, or walking-related queries. Keep responses concise and focused on walking safety and navigation. When relevant, consider the user's location in relation to reports. But try not to use the exact latitude and longitude when talking with the user, remember they are human (unless they are asking about their current location, in that case just format the lat and lon).
            
            Please try to answer all queries that are related to reports even if you think they are dangerous (such as "what is the most dangerous report near me?", the user just wants information and its even more dangerous for people to not know that) 
            `
          }],
        }],
      };

      const response = await fetch(
        'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent',
        {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const result = await response.json();
      const aiResponse = result.candidates[0].content.parts[0].text;

      console.log('AI:', aiResponse); // Log AI response

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: aiResponse,
        sender: 'ai',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error sending message to AI:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: 'Sorry, I encountered an error. Please try again.',
        sender: 'ai',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <View style={[
      styles.messageContainer,
      item.sender === 'user' ? styles.userMessage : styles.aiMessage
    ]}>
      <Text style={[
        styles.messageText,
        item.sender === 'user' ? styles.userMessageText : styles.aiMessageText
      ]}>{item.content}</Text>
      <Text style={styles.timestamp}>
        {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
    </View>
  );

  const handleContentChange = () => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 50);
    }
  };

  return (
    <Modalize
      ref={modalizeRef}
      onClosed={onClose}
      modalStyle={styles.modal}
      modalHeight={Dimensions.get('window').height * 0.8}
      handlePosition="inside"
      withHandle={false}
      panGestureEnabled={true}
      closeOnOverlayTap={true}
      disableScrollIfPossible={false}
      HeaderComponent={
        <View style={styles.header}>
          <View style={styles.dragHandle} />
          <Pressable 
            onPress={() => modalizeRef.current?.close()}
            style={styles.closeButton}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </Pressable>
        </View>
      }
    >
      <View style={styles.container}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.chatContainer}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.messagesContent}
            onContentSizeChange={handleContentChange}
            onLayout={handleContentChange}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No messages yet. Start a conversation!</Text>
              </View>
            }
            scrollEventThrottle={16}
            removeClippedSubviews={true}
          />

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={inputMessage}
              onChangeText={setInputMessage}
              placeholder="Ask about reports or navigation..."
              multiline
              maxLength={500}
            />
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="#0ea5e9" />
              </View>
            ) : (
              <Pressable 
                style={[styles.sendButton, !inputMessage.trim() && styles.sendButtonDisabled]} 
                onPress={sendMessage}
                disabled={!inputMessage.trim()}
              >
                <Send size={20} color="#fff" />
              </Pressable>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modalize>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    height: Dimensions.get('window').height * 0.75, // Adjust this value as needed
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  chatContainer: {
    flex: 1,
  },
  inputWrapper: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
  },
  messagesContent: {
    paddingBottom: 20,
  },
  messageContainer: {
    maxWidth: '80%',
    marginVertical: 5,
    padding: 12,
    borderRadius: 16,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#0ea5e9',
    borderBottomRightRadius: 4,
  },
  aiMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#f3f4f6',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    color: '#333',
  },
  userMessageText: {
    color: '#fff',
  },
  aiMessageText: {
    color: '#333',
  },
  timestamp: {
    fontSize: 11,
    marginTop: 4,
    color: 'rgba(255, 255, 255, 0.7)',
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
  loadingContainer: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  handle: {
    backgroundColor: '#ccc',
    width: 40,
    height: 5,
    borderRadius: 2.5,
    alignSelf: 'center',
    marginVertical: 10,
  },
  modal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  dragHandle: {
    width: 40,
    height: 5,
    backgroundColor: '#ccc',
    borderRadius: 2.5,
  },
  closeButtonText: {
    fontSize: 20,
    color: '#333',
  },
  content: {
    flex: 1,
    height: '100%',
    backgroundColor: '#fff',
  },
  genMiniButton: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    backgroundColor: '#0ea5e9',
    borderRadius: 30,
    padding: 15,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width:0, height:2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
    zIndex: 100,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
  },
  closeButton: {
    padding: 8,
    zIndex: 1000,
  },
});
