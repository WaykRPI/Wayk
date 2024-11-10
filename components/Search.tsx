import React, { useState, useRef } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Text,
  Keyboard,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Search, X } from 'lucide-react-native';

const PlacesSearch = ({ onPlaceSelect }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const animatedHeight = useRef(new Animated.Value(0)).current;

  const searchPlaces = async (query) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    try {
      // Using Nominatim OpenStreetMap API for geocoding
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          query
        )}&limit=5`
      );
      const data = await response.json();
      
      const formattedResults = data.map(item => ({
        id: item.place_id,
        name: item.display_name,
        latitude: parseFloat(item.lat),
        longitude: parseFloat(item.lon)
      }));
      
      setResults(formattedResults);
    } catch (error) {
      console.error('Error searching places:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchChange = (text) => {
    setSearchQuery(text);
    if (text.length >= 3) {
      searchPlaces(text);
    } else {
      setResults([]);
    }
  };

  const handlePlaceSelect = (place) => {
    onPlaceSelect(place);
    setSearchQuery(place.name);
    setResults([]);
    Keyboard.dismiss();
    setIsExpanded(false);
    animateSearchBar(false);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setResults([]);
    setIsExpanded(false);
    animateSearchBar(false);
  };

  const animateSearchBar = (expand) => {
    Animated.timing(animatedHeight, {
      toValue: expand ? 300 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const handleFocus = () => {
    setIsExpanded(true);
    animateSearchBar(true);
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.resultItem}
      onPress={() => handlePlaceSelect(item)}
    >
      <Text style={styles.placeName} numberOfLines={1}>
        {item.name.split(',')[0]}
      </Text>
      <Text style={styles.placeAddress} numberOfLines={2}>
        {item.name.split(',').slice(1).join(',')}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Search size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search places..."
          value={searchQuery}
          onChangeText={handleSearchChange}
          onFocus={handleFocus}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
            <X size={20} color="#666" />
          </TouchableOpacity>
        )}
      </View>

      <Animated.View style={[styles.resultsContainer, { height: animatedHeight }]}>
        {isLoading ? (
          <ActivityIndicator style={styles.loader} color="#0ea5e9" />
        ) : (
          <FlatList
            data={results}
            renderItem={renderItem}
            keyExtractor={(item) => item.id.toString()}
            keyboardShouldPersistTaps="handled"
            style={styles.resultsList}
          />
        )}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
    zIndex: 1000,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 25,
    paddingHorizontal: 15,
    height: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  clearButton: {
    padding: 5,
  },
  resultsContainer: {
    backgroundColor: 'white',
    borderRadius: 15,
    marginTop: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  resultsList: {
    flex: 1,
  },
  resultItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  placeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  placeAddress: {
    fontSize: 14,
    color: '#666',
  },
  loader: {
    padding: 20,
  },
});

export default PlacesSearch;