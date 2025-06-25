import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ActivityIndicator, ScrollView } from 'react-native';
import { useAuth } from '../../store/useAuth';
import { doc, updateDoc } from 'firebase/firestore';
import { firestore } from '../../lib/firebase';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../../components/Header';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useRouter } from 'expo-router';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, signOut, setUser } = useAuth();
  const [newDisplayName, setNewDisplayName] = useState(user?.displayName || "");
  const [loading, setLoading] = useState(false);
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [updateMessage, setUpdateMessage] = useState('');

  console.log('[SettingsScreen] Component rendered for user:', user?.email);

  const handleUpdateProfile = async () => {
    if (!user || !newDisplayName.trim()) {
      setUpdateMessage("Display name cannot be empty.");
      setShowUpdateDialog(true);
      return;
    }
    
    console.log('[SettingsScreen] Updating profile for user:', user.uid);
    setLoading(true);
    
    try {
      const userRef = doc(firestore, "users", user.uid);
      await updateDoc(userRef, {
        displayName: newDisplayName,
      });

      // Update the local user state in Zustand
      const updatedUser = { ...user, displayName: newDisplayName };
      setUser(updatedUser);

      console.log('[SettingsScreen] Profile updated successfully');
      setUpdateMessage("Your display name has been updated.");
      setShowUpdateDialog(true);
    } catch (error) {
      console.error("[SettingsScreen] Error updating profile:", error);
      setUpdateMessage("Failed to update your profile.");
      setShowUpdateDialog(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    console.log('[SettingsScreen] Sign out requested');
    setShowSignOutDialog(true);
  };

  const confirmSignOut = async () => {
    console.log('[SettingsScreen] Proceeding with sign out');
    setShowSignOutDialog(false);
    setLoading(true);
    try {
      await signOut();
      console.log('[SettingsScreen] Sign out successful');
      // Navigation will be handled by the auth state change
      router.replace('/');
    } catch (error) {
      console.error("[SettingsScreen] Error signing out:", error);
      setLoading(false);
      setUpdateMessage("Failed to sign out. Please try again.");
      setShowUpdateDialog(true);
    }
  };

  const cancelSignOut = () => {
    console.log('[SettingsScreen] Sign out cancelled');
    setShowSignOutDialog(false);
  };

  const dismissUpdateDialog = () => {
    console.log('[SettingsScreen] Update dialog dismissed');
    setShowUpdateDialog(false);
    setUpdateMessage('');
  };

  const handleNavigateToFriends = () => {
    console.log('[SettingsScreen] Navigating to friends page');
    router.push("/(protected)/friends");
  };

  const handleNavigateToAddFriend = () => {
    console.log('[SettingsScreen] Navigating to add friend page');
    router.push("/(protected)/add-friend");
  };

  const handleNavigateToHome = () => {
    console.log('[SettingsScreen] Navigating to home page');
    router.push("/(protected)/home");
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Settings" showBackButton />
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* User Profile Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile Information</Text>
          
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.emailContainer}>
              <Text style={styles.emailText}>{user?.email}</Text>
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedText}>✓ Verified</Text>
              </View>
            </View>
          </View>

          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Display Name</Text>
            <TextInput
              style={styles.input}
              value={newDisplayName}
              onChangeText={setNewDisplayName}
              placeholder="Enter your display name"
              autoCapitalize="words"
            />
            <TouchableOpacity
              style={[styles.updateButton, loading && styles.buttonDisabled]}
              onPress={handleUpdateProfile}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.updateButtonText}>Update Display Name</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Actions Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          
          <TouchableOpacity style={styles.actionButton} onPress={handleNavigateToHome}>
            <Text style={styles.actionIcon}>🏠</Text>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Go to Inbox</Text>
              <Text style={styles.actionSubtitle}>View your messages</Text>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={handleNavigateToFriends}>
            <Text style={styles.actionIcon}>👥</Text>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Manage Friends</Text>
              <Text style={styles.actionSubtitle}>View and manage your friend list</Text>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={handleNavigateToAddFriend}>
            <Text style={styles.actionIcon}>➕</Text>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Add Friends</Text>
              <Text style={styles.actionSubtitle}>Find and add new friends</Text>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* App Information Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Information</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>App Version</Text>
            <Text style={styles.infoValue}>1.0.0</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>User ID</Text>
            <Text style={styles.infoValue}>{user?.uid?.slice(-8) || 'N/A'}</Text>
          </View>
        </View>

        {/* Danger Zone */}
        <View style={[styles.section, styles.dangerSection]}>
          <Text style={styles.sectionTitle}>Account</Text>
          
          <TouchableOpacity style={styles.logoutButton} onPress={handleSignOut}>
            <Text style={styles.logoutIcon}>🚪</Text>
            <Text style={styles.logoutButtonText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <ConfirmDialog
        visible={showSignOutDialog}
        title="Sign Out"
        message="Are you sure you want to sign out?"
        confirmText="Sign Out"
        cancelText="Cancel"
        confirmColor="red"
        onConfirm={confirmSignOut}
        onCancel={cancelSignOut}
      />

      <ConfirmDialog
        visible={showUpdateDialog}
        title="Notice"
        message={updateMessage}
        confirmText="OK"
        cancelText="OK"
        confirmColor="blue"
        onConfirm={dismissUpdateDialog}
        onCancel={dismissUpdateDialog}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  dangerSection: {
    borderColor: '#fecaca',
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  fieldContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  emailContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emailText: {
    fontSize: 16,
    color: '#1f2937',
    flex: 1,
  },
  verifiedBadge: {
    backgroundColor: '#d1fae5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#065f46',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    backgroundColor: '#fff',
    marginBottom: 12,
  },
  updateButton: {
    backgroundColor: '#3b82f6',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  updateButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    marginBottom: 8,
  },
  actionIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  actionSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  actionArrow: {
    fontSize: 20,
    color: '#9ca3af',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  infoLabel: {
    fontSize: 16,
    color: '#374151',
  },
  infoValue: {
    fontSize: 16,
    color: '#6b7280',
    fontFamily: 'monospace',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ef4444',
    padding: 16,
    borderRadius: 8,
  },
  logoutIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  logoutButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
}); 