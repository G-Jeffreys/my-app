import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
} from "react-native";
import React, { useState } from "react";
import { collection, query, where, getDocs, setDoc, doc, Firestore, limit } from "firebase/firestore";
import { firestore, auth } from "../../lib/firebase";
import { User } from "../../models/firestore/user";
import Header from "../../components/Header";
import { SafeAreaView } from "react-native-safe-area-context";

export default function AddFriendScreen() {
  const [searchEmail, setSearchEmail] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [requesting, setRequesting] = useState<Record<string, boolean>>({});

  console.log('[AddFriend] Component loaded - auth user:', auth.currentUser?.email);
  console.log('[AddFriend] Firebase auth state ready:', !!auth.currentUser);

  const handleSearch = async () => {
    if (searchEmail.trim() === "") {
      Alert.alert("Error", "Please enter an email to search.");
      return;
    }
    
    console.log('[AddFriend] Starting user search for email:', searchEmail.toLowerCase());
    console.log('[AddFriend] Current user authenticated:', !!auth.currentUser);
    console.log('[AddFriend] Current user UID:', auth.currentUser?.uid);
    
    setLoading(true);
    setSearchResults([]);
    
    try {
      const q = query(
        collection(firestore, "users"),
        where("email", "==", searchEmail.toLowerCase()),
        limit(10) // Safety limit to prevent excessive queries
      );
      
      console.log('[AddFriend] Executing Firestore query...');
      const querySnapshot = await getDocs(q);
      console.log('[AddFriend] Query completed, found docs:', querySnapshot.size);
      
      const users: User[] = querySnapshot.docs.map(
        (doc) => {
          console.log('[AddFriend] Processing user doc:', doc.id, doc.data());
          return { id: doc.id, ...doc.data() } as User;
        }
      );
      
      // Filter out the current user from search results
      const filteredUsers = users.filter(user => {
        const isCurrentUser = user.id === auth.currentUser?.uid;
        console.log('[AddFriend] User filtering - ID:', user.id, 'isCurrentUser:', isCurrentUser);
        return !isCurrentUser;
      });
      
      console.log('[AddFriend] Final filtered results:', filteredUsers.length);
      console.log('[AddFriend] User emails found:', filteredUsers.map(u => u.email));
      setSearchResults(filteredUsers);
      
      if (filteredUsers.length === 0) {
        console.log('[AddFriend] No results found for email:', searchEmail);
        Alert.alert("No Results", "No user found with that email.");
      } else {
        console.log('[AddFriend] Search successful, showing results');
      }
    } catch (error: any) {
      console.error("[AddFriend] Error searching for user:", error);
      console.error("[AddFriend] Error code:", error?.code);
      console.error("[AddFriend] Error message:", error?.message);
      console.error("[AddFriend] Full error object:", JSON.stringify(error, null, 2));
      
      let errorMessage = "An error occurred while searching.";
      if (error?.code === 'permission-denied') {
        errorMessage = "Permission denied. Please check your authentication and try again.";
      } else if (error?.code === 'unavailable') {
        errorMessage = "Service temporarily unavailable. Please try again later.";
      } else if (error?.message) {
        errorMessage = `Search failed: ${error.message}`;
      }
      
      Alert.alert("Search Error", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const sendFriendRequest = async (recipient: User) => {
    if (!auth.currentUser) return;
    setRequesting((prev) => ({ ...prev, [recipient.id]: true }));
    try {
      const requestRef = doc(
        firestore,
        "friendRequests",
        `${auth.currentUser.uid}_${recipient.id}`
      );
      await setDoc(requestRef, {
        senderId: auth.currentUser.uid,
        recipientId: recipient.id,
        senderEmail: auth.currentUser.email,
        status: "pending",
        createdAt: new Date(),
      });
      Alert.alert("Success", `Friend request sent to ${recipient.displayName}!`);
    } catch (error) {
      console.error("Error sending friend request:", error);
      Alert.alert("Error", "Failed to send friend request.");
    } finally {
      setRequesting((prev) => ({ ...prev, [recipient.id]: false }));
    }
  };

  const renderUser = ({ item }: { item: User }) => (
    <View style={styles.userRow}>
      <Image source={{ uri: item.photoURL || "" }} style={styles.avatar} />
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.displayName}</Text>
        <Text style={styles.userEmail}>{item.email}</Text>
      </View>
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => sendFriendRequest(item)}
        disabled={requesting[item.id]}
      >
        {requesting[item.id] ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.addButtonText}>Add</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Add Friend" showBackButton />
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.input}
          placeholder="Enter friend's email"
          value={searchEmail}
          onChangeText={setSearchEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
          <Text style={styles.searchButtonText}>Search</Text>
        </TouchableOpacity>
      </View>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={searchResults}
          renderItem={renderUser}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Search for a user to add them as a friend.</Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "white" },
    searchContainer: {
      flexDirection: "row",
      padding: 10,
      borderBottomWidth: 1,
      borderBottomColor: "#eee",
    },
    input: {
      flex: 1,
      borderWidth: 1,
      borderColor: "#ddd",
      padding: 10,
      borderRadius: 8,
      marginRight: 10,
    },
    searchButton: {
      backgroundColor: "#007AFF",
      padding: 10,
      borderRadius: 8,
      justifyContent: "center",
    },
    searchButtonText: {
      color: "white",
      fontWeight: "bold",
    },
    userRow: {
      flexDirection: "row",
      alignItems: "center",
      padding: 10,
      borderBottomWidth: 1,
      borderBottomColor: "#eee",
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 10,
    },
    userInfo: {
        flex: 1,
    },
    userName: {
        fontWeight: 'bold'
    },
    userEmail: {
        color: 'gray'
    },
    addButton: {
        backgroundColor: 'green',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 5,
    },
    addButtonText: {
        color: 'white',
        fontWeight: 'bold',
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 20,
        color: 'gray',
    }
}); 