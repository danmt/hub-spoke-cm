// packages/mobile/app/(tabs)/hubs/index.tsx
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { useWorkspace } from "@/services/WorkspaceContext";
import { WorkspaceManager } from "@/services/WorkspaceManager";
import { FontAwesome } from "@expo/vector-icons";
import { IoService } from "@hub-spoke/core";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
} from "react-native";

interface HubItem {
  id: string;
  title: string;
  canFill: boolean;
}

export default function HubsScreen() {
  const { activeWorkspace, isLoading: workspaceLoading } = useWorkspace();
  const colorScheme = useColorScheme() ?? "light";
  const themeColors = Colors[colorScheme];
  const router = useRouter();

  const [hubs, setHubs] = useState<HubItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchHubs = async () => {
    if (!activeWorkspace) return;
    setIsLoading(true);
    try {
      const workspaceDir = WorkspaceManager.getWorkspaceUri(activeWorkspace);
      const hubIds = await IoService.findAllHubsInWorkspace(workspaceDir.uri);

      const hubItems: HubItem[] = await Promise.all(
        hubIds.map(async (id) => {
          try {
            const workspaceDir =
              WorkspaceManager.getWorkspaceUri(activeWorkspace);
            const hubPath = `${workspaceDir.uri}/posts/${id}`;
            const parsed = await IoService.readHub(hubPath);
            const canFill = />\s*\*\*?TODO:?\*?\s*/i.test(parsed.content);

            return { id, title: parsed.frontmatter.title, canFill };
          } catch {
            return { id, title: id, canFill: false };
          }
        }),
      );

      setHubs(hubItems);
    } catch (err) {
      console.error("Failed to fetch hubs:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchHubs();
    }, [activeWorkspace, workspaceLoading]),
  );

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
              <Text style={styles.hubTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.hubId}>ID: {item.id}</Text>
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
                    backgroundColor: themeColors.buttonPrimary,
                    borderWidth: 0,
                  },
                ]}
                onPress={() => console.log("Fill placeholder")}
                disabled={!item.canFill}
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
  hubCard: { padding: 20, borderRadius: 20, marginBottom: 16 },
  hubHeader: { marginBottom: 15, backgroundColor: "transparent" },
  hubTitle: { fontSize: 18, fontWeight: "bold" },
  hubId: { fontSize: 12, opacity: 0.5, marginTop: 2 },
  actionRow: { flexDirection: "row", gap: 10, backgroundColor: "transparent" },
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
