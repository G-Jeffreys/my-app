import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, TextInput, ActivityIndicator } from 'react-native';
import { useAuth } from '../../store/useAuth';
import { doc, updateDoc } from 'firebase/firestore';
import { firestore } from '../../lib/firebase';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../../components/Header';

export default function SettingsScreen() {
  const { user, signOut, setUser } = useAuth();
  const [newDisplayName, setNewDisplayName] = useState(user?.displayName || "");
  const [loading, setLoading] = useState(false);

  const handleUpdateProfile = async () => {
    if (!user || !newDisplayName.trim()) {
      Alert.alert("Error", "Display name cannot be empty.");
      return;
    }
    setLoading(true);
    try {
      const userRef = doc(firestore, "users", user.uid);
      await updateDoc(userRef, {
        displayName: newDisplayName,
      });

      // Update the local user state in Zustand
      const updatedUser = { ...user, displayName: newDisplayName };
      setUser(updatedUser);

      Alert.alert("Success", "Your display name has been updated.");
    } catch (error) {
      console.error("Error updating profile:", error);
      Alert.alert("Error", "Failed to update your profile.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Settings" showBackButton />
      <View style={styles.content}>
        <Text style={styles.label}>Email</Text>
        <Text style={styles.emailText}>{user?.email}</Text>

        <Text style={styles.label}>Display Name</Text>
        <TextInput
          style={styles.input}
          value={newDisplayName}
          onChangeText={setNewDisplayName}
          placeholder="Enter your display name"
        />
        <TouchableOpacity
          style={styles.updateButton}
          onPress={handleUpdateProfile}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Update Profile</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutButton} onPress={signOut}>
          <Text style={styles.buttonText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  content: {
    padding: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: 'gray',
    marginTop: 20,
  },
  emailText: {
    fontSize: 18,
    paddingVertical: 10,
    color: '#333',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 10,
    borderRadius: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 10,
    borderRadius: 8,
    fontSize: 16,
    marginTop: 5,
  },
  updateButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  logoutButton: {
    backgroundColor: 'red',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 40,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
}); 