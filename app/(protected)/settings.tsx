import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Platform } from 'react-native';
import { useAuth } from '../../store/useAuth';
import { firestore } from '../../lib/firebase';
import { ANALYTICS_EVENTS, logEvent } from '../../lib/analytics';
import Header from '../../components/Header';

const TTL_PRESETS = ['30s', '1m', '5m', '1h', '6h', '24h'];

const SettingsScreen = () => {
  const { user } = useAuth();
  const [defaultTtl, setDefaultTtl] = useState('1h');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchUserSettings = async () => {
      if (!user) return;
      
      if (Platform.OS === 'web') {
        // Web mock - use default 1h
        setDefaultTtl('1h');
        return;
      }
      
      // Mobile Firebase
      const userRef = (firestore as any)().collection('users').doc(user.uid);
      const userSnap = await userRef.get();
      if (userSnap.exists() && userSnap.data()?.defaultTtl) {
        setDefaultTtl(userSnap.data()!.defaultTtl);
      }
    };
    fetchUserSettings();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (Platform.OS === 'web') {
        // Web mock
        Alert.alert('Mock Action', `Default TTL would be set to ${defaultTtl}`);
      } else {
        // Mobile Firebase
        const userRef = (firestore as any)().collection('users').doc(user.uid);
        await userRef.update({ defaultTtl });
        Alert.alert('Success', 'Default TTL saved!');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      Alert.alert('Error', 'Could not save settings.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-white">
      <Header title="Settings" showBackButton={true} />
      
      <View style={styles.container}>
      <Text style={styles.label}>Default Snap TTL</Text>
      <View style={styles.ttlContainer}>
        {TTL_PRESETS.map((ttl) => (
          <TouchableOpacity
            key={ttl}
            style={[styles.ttlButton, defaultTtl === ttl && styles.ttlButtonSelected]}
            onPress={() => {
              setDefaultTtl(ttl);
              logEvent(ANALYTICS_EVENTS.TTL_SELECTED, { ttl, screen: 'settings' });
            }}
          >
            <Text style={styles.ttlButtonText}>{ttl}</Text>
          </TouchableOpacity>
        ))}
      </View>
        <TouchableOpacity onPress={handleSave} disabled={loading} style={styles.saveButton}>
          <Text style={styles.saveButtonText}>{loading ? 'Saving...' : 'Save'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: 'white',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  label: {
    fontSize: 18,
    marginBottom: 10,
  },
  ttlContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 30,
  },
  ttlButton: {
    padding: 15,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    margin: 5,
  },
  ttlButtonSelected: {
    backgroundColor: '#007BFF',
  },
  ttlButtonText: {
    color: 'black',
  },
  saveButton: {
    backgroundColor: '#007BFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default SettingsScreen; 