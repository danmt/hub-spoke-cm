// packages/mobile/app/(tabs)/hubs.tsx
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { useWorkspace } from "@/services/WorkspaceContext";
import { WorkspaceManager } from "@/services/WorkspaceManager";
import { FontAwesome } from "@expo/vector-icons";
import { IoService } from "@hub-spoke/core";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
} from "react-native";

export default function HubsScreen() {
  const { activeWorkspace, isLoading: workspaceLoading } = useWorkspace();
  const colorScheme = useColorScheme() ?? "light";
  const themeColors = Colors[colorScheme];
  const router = useRouter();

  const [hubs, setHubs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchHubs = async () => {
    if (!activeWorkspace) return;
    setIsLoading(true);
    try {
      const workspaceRoot = WorkspaceManager.getWorkspaceUri(activeWorkspace);
      const hubIds = await IoService.findAllHubsInWorkspace(workspaceRoot.uri);
      setHubs(hubIds);
    } catch (err) {
      console.error("Failed to fetch hubs:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!workspaceLoading && activeWorkspace) {
      fetchHubs();
    }
  }, [activeWorkspace, workspaceLoading]);

  if (!activeWorkspace) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>Select a workspace to manage hubs.</Text>
      </View>
    );
  }

  if (isLoading || workspaceLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="small" color={themeColors.tint} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={hubs}
        keyExtractor={(item) => item}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <FontAwesome name="file-text-o" size={40} color="#ccc" />
            <Text style={styles.emptyText}>
              No hubs found in this workspace.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={[
              styles.hubCard,
              { backgroundColor: themeColors.cardBackground },
            ]}
            onPress={() => {
              /* Future: Navigate to hub details */
            }}
          >
            <View style={styles.hubInfo}>
              <Text style={styles.hubId}>{item}</Text>
              <Text style={styles.hubStatus}>Ready for generation</Text>
            </View>
            <FontAwesome name="chevron-right" size={14} color="#888" />
          </Pressable>
        )}
      />

      <Pressable
        style={[styles.fab, { backgroundColor: themeColors.buttonPrimary }]}
        onPress={() => router.push("/new-hub")}
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
  hubCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  hubInfo: { backgroundColor: "transparent" },
  hubId: { fontSize: 17, fontWeight: "bold" },
  hubStatus: { fontSize: 12, opacity: 0.5, marginTop: 4 },
  emptyContainer: {
    alignItems: "center",
    marginTop: 100,
    backgroundColor: "transparent",
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
