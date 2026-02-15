// packages/mobile/app/(tabs)/index.tsx
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { useWorkspace } from "@/services/WorkspaceContext";
import { WorkspaceManager } from "@/services/WorkspaceManager";
import { FontAwesome } from "@expo/vector-icons";
import { Artifact, IoService, RegistryService } from "@hub-spoke/core";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
} from "react-native";

export default function HomeScreen() {
  const { activeWorkspace, isLoading } = useWorkspace();
  const colorScheme = useColorScheme() ?? "light";
  const themeColors = Colors[colorScheme];
  const router = useRouter();

  const [agents, setAgents] = useState<Artifact[]>([]);
  const [hubCount, setHubCount] = useState(0);

  useEffect(() => {
    async function syncDashboardData() {
      if (!isLoading && activeWorkspace) {
        // 1. Load Agents from primed cache
        const cachedAgents = RegistryService.getCachedArtifacts();
        setAgents(cachedAgents);

        // 2. Load Hub Count using the absolute Workspace URI
        try {
          const workspaceDir =
            WorkspaceManager.getWorkspaceUri(activeWorkspace);
          const hubIds = await IoService.findAllHubsInWorkspace(
            workspaceDir.uri,
          );
          setHubCount(hubIds.length);
        } catch (err) {
          console.error("Dashboard sync error:", err);
          setHubCount(0);
        }

        console.log(`🏠 Dashboard: [${activeWorkspace}] synced.`);
      }
    }

    syncDashboardData();
  }, [activeWorkspace, isLoading]);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={themeColors.tint} />
        <Text style={styles.statusText}>Syncing Workspace...</Text>
      </View>
    );
  }

  if (!activeWorkspace) {
    return (
      <View style={styles.centered}>
        <FontAwesome
          name="folder-open-o"
          size={50}
          color="#ccc"
          style={{ marginBottom: 20 }}
        />
        <Text style={styles.title}>No Active Workspace</Text>
        <View
          style={styles.separator}
          lightColor="#eee"
          darkColor="rgba(255,255,255,0.1)"
        />
        <Text style={styles.emptyText}>
          Select or create a workspace in settings to begin managing content.
        </Text>
        <Pressable
          style={[
            styles.primaryButton,
            { marginTop: 30, backgroundColor: themeColors.buttonPrimary },
          ]}
          onPress={() => router.push("/settings")}
        >
          <Text style={styles.buttonTextBold}>Go to Settings →</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      <View style={styles.header}>
        <View style={{ backgroundColor: "transparent" }}>
          <Text style={styles.title}>Dashboard 2</Text>
          <View style={styles.badgeContainer}>
            <Text
              style={[
                styles.badge,
                {
                  backgroundColor: themeColors.buttonPrimary + "20",
                  color: themeColors.buttonPrimary,
                },
              ]}
            >
              {activeWorkspace}
            </Text>
          </View>
        </View>
      </View>

      <View
        style={styles.separator}
        lightColor="#eee"
        darkColor="rgba(255,255,255,0.1)"
      />

      {/* Production Layer Summary */}
      <Text style={styles.sectionTitle}>Content Strategy</Text>
      <View
        style={[
          styles.summaryCard,
          { backgroundColor: themeColors.cardBackground, marginBottom: 20 },
        ]}
      >
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{hubCount}</Text>
            <Text style={styles.statLabel}>Active Hubs</Text>
          </View>
          <View style={styles.statItem}>
            <View
              style={[
                styles.iconCircle,
                { backgroundColor: themeColors.tint + "20" },
              ]}
            >
              <FontAwesome name="sitemap" size={20} color={themeColors.tint} />
            </View>
          </View>
        </View>

        <Pressable
          style={styles.viewMoreButton}
          onPress={() => router.push("/hubs")}
        >
          <Text style={{ color: themeColors.tint, fontWeight: "bold" }}>
            Manage Content Hubs →
          </Text>
        </Pressable>
      </View>

      {/* Intelligence Layer Section */}
      <Text style={styles.sectionTitle}>Intelligence Layer</Text>
      <View
        style={[
          styles.summaryCard,
          { backgroundColor: themeColors.cardBackground },
        ]}
      >
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {agents.filter((a) => a.type === "persona").length}
            </Text>
            <Text style={styles.statLabel}>Personas</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {agents.filter((a) => a.type === "writer").length}
            </Text>
            <Text style={styles.statLabel}>Writers</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {agents.filter((a) => a.type === "assembler").length}
            </Text>
            <Text style={styles.statLabel}>Assemblers</Text>
          </View>
        </View>

        <Pressable
          style={styles.viewMoreButton}
          onPress={() => router.push("/agents")}
        >
          <Text style={{ color: themeColors.tint, fontWeight: "bold" }}>
            View Agent Registry →
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 25, paddingTop: 60 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "transparent",
  },
  badgeContainer: {
    flexDirection: "row",
    backgroundColor: "transparent",
    marginTop: 5,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    fontSize: 11,
    fontWeight: "bold",
    overflow: "hidden",
  },
  title: { fontSize: 32, fontWeight: "bold" },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "900",
    marginTop: 30,
    marginBottom: 15,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    opacity: 0.5,
  },
  separator: { marginVertical: 25, height: 1, width: "100%" },
  summaryCard: { padding: 20, borderRadius: 20 },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    marginBottom: 20,
    backgroundColor: "transparent",
  },
  statItem: { alignItems: "center", backgroundColor: "transparent" },
  statNumber: { fontSize: 28, fontWeight: "bold" },
  statLabel: { fontSize: 12, opacity: 0.6, marginTop: 4 },
  iconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
  },
  viewMoreButton: {
    alignItems: "center",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(128,128,128,0.1)",
  },
  statusText: { marginTop: 20, fontSize: 16, opacity: 0.6 },
  emptyText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
  },
  primaryButton: {
    height: 50,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },
  buttonTextBold: { color: "#fff", fontWeight: "bold" },
});
