// packages/mobile/app/(tabs)/hubs/index.tsx
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import { Colors } from "@/constants/Colors";
import { useHubs } from "@/services/HubsContext";
import { useWorkspace } from "@/services/WorkspaceContext";
import { FontAwesome } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
} from "react-native";

export default function HubsScreen() {
  const { activeWorkspace, manifest, isLoading } = useWorkspace();
  const { deleteHub } = useHubs();
  const colorScheme = useColorScheme() ?? "dark";
  const themeColors = Colors[colorScheme];
  const router = useRouter();

  if (!activeWorkspace) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>Select a workspace to manage hubs.</Text>
      </View>
    );
  }

  if (isLoading || !manifest) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="small" color={themeColors.tint} />
      </View>
    );
  }

  const confirmDelete = (id: string) => {
    Alert.alert(
      "Delete Hub",
      `Are you sure you want to delete "${id}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteHub(id),
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={manifest.hubs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <FontAwesome name="file-text-o" size={40} color="#ccc" />
            <Text style={styles.emptyText}>No hubs found.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View
            style={[
              styles.hubCard,
              { backgroundColor: themeColors.cardBackground },
            ]}
          >
            <View style={styles.hubHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.hubTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.hubId}>ID: {item.id}</Text>
              </View>
              <Pressable
                onPress={() => confirmDelete(item.id)}
                style={styles.trashBtn}
              >
                <FontAwesome name="trash-o" size={20} color="#ff4444" />
              </Pressable>
            </View>

            <View style={styles.actionRow}>
              <Pressable
                style={[styles.actionBtn, { borderColor: themeColors.tint }]}
                onPress={() =>
                  router.push({
                    pathname: "/(tabs)/hubs/details",
                    params: { id: item.id },
                  })
                }
              >
                <FontAwesome name="eye" size={14} color={themeColors.tint} />
                <Text style={[styles.actionText, { color: themeColors.tint }]}>
                  View
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.actionBtn,
                  {
                    backgroundColor: item.hasTodo
                      ? themeColors.buttonPrimary
                      : "#888",
                    borderWidth: 0,
                  },
                ]}
                onPress={() =>
                  router.push({
                    pathname: "/hubs/fill",
                    params: { id: item.id },
                  })
                }
                disabled={!item.hasTodo}
              >
                <FontAwesome name="magic" size={14} color="#fff" />
                <Text style={[styles.actionText, { color: "#fff" }]}>Fill</Text>
              </Pressable>
            </View>
          </View>
        )}
      />

      <Pressable
        style={[styles.fab, { backgroundColor: themeColors.buttonPrimary }]}
        onPress={() => router.push("/hubs/new")}
      >
        <FontAwesome name="plus" size={24} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  listContent: { padding: 20, paddingBottom: 100 },
  hubCard: { padding: 20, borderRadius: 20, marginBottom: 16 },
  hubHeader: {
    marginBottom: 15,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  hubTitle: { fontSize: 18, fontWeight: "bold" },
  hubId: { fontSize: 12, opacity: 0.5, marginTop: 2 },
  trashBtn: { padding: 5, marginLeft: 10 },
  actionRow: { flexDirection: "row", gap: 10 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  actionText: { fontSize: 13, fontWeight: "700" },
  emptyContainer: {
    alignItems: "center",
    marginTop: 100,
  },
  emptyText: { marginTop: 15, opacity: 0.5, fontSize: 16 },
  fab: {
    position: "absolute",
    right: 25,
    bottom: 25,
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});
