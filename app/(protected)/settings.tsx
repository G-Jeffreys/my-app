import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useAuth } from '../../store/useAuth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';

const TTL_PRESETS = ['30s', '1m', '5m', '1h', '6h', '24h'];

export default function SettingsScreen() {
  const { user } = useAuth();
  const [defaultTtl, setDefaultTtl] = useState('1h');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchUserSettings = async () => {
      if (!user) return;
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists() && userSnap.data().defaultTtl) {
        setDefaultTtl(userSnap.data().defaultTtl);
      }
    };
    fetchUserSettings();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { defaultTtl });
      Alert.alert('Success', 'Default TTL saved!');
    } catch (error) {
      console.error('Error saving settings:', error);
      Alert.alert('Error', 'Could not save settings.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.label}>Default Snap TTL</Text>
      <View style={styles.ttlContainer}>
        {TTL_PRESETS.map((ttl) => (
          <TouchableOpacity
            key={ttl}
            style={[styles.ttlButton, defaultTtl === ttl && styles.ttlButtonSelected]}
            onPress={() => setDefaultTtl(ttl)}
          >
            <Text style={styles.ttlButtonText}>{ttl}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity onPress={handleSave} disabled={loading} style={styles.saveButton}>
        <Text style={styles.saveButtonText}>{loading ? 'Saving...' : 'Save'}</Text>
      </TouchableOpacity>
    </View>
  );
}

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