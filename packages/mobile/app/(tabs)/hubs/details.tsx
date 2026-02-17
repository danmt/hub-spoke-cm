// packages/mobile/app/(tabs)/hubs/details.tsx
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import { Colors } from "@/constants/Colors";
import { ExportService } from "@/services/ExportService";
import { useHubs } from "@/services/HubsContext";
import { useWorkspace } from "@/services/WorkspaceContext";
import { WorkspaceManager } from "@/services/WorkspaceManager";
import { FontAwesome } from "@expo/vector-icons";
import { ParsedFile } from "@hub-spoke/core";
import { Directory } from "expo-file-system";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  LayoutAnimation,
  Pressable,
  ScrollView,
  StyleSheet,
} from "react-native";

export default function HubDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activeWorkspace } = useWorkspace();
  const { getFullHub, deleteHub } = useHubs();
  const themeColors = Colors[useColorScheme() ?? "dark"];
  const router = useRouter();

  const [hubData, setHubData] = useState<ParsedFile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  useEffect(() => {
    async function loadHub() {
      if (!activeWorkspace || !id) return;
      try {
        const data = await getFullHub(id);
        setHubData(data);
      } catch (err) {
        console.error("Failed to load hub details:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadHub();
  }, [id, activeWorkspace, getFullHub]);

  const toggleSection = (sectionId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedSection(expandedSection === sectionId ? null : sectionId);
  };

  const handleExport = async () => {
    if (!activeWorkspace || !id) return;
    try {
      const workspaceDir = WorkspaceManager.getWorkspaceUri(activeWorkspace);
      const hubDir = new Directory(workspaceDir, "posts", id);
      await ExportService.exportHub(hubDir.uri);
    } catch (err: any) {
      console.error("Export failed:", err.message);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete Hub",
      "Are you sure? This will permanently remove the hub and all its content.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            router.dismissAll();
            router.replace("/(tabs)/hubs");
            await deleteHub(id!);
          },
        },
      ],
    );
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={themeColors.tint} />
      </View>
    );
  }

  if (!hubData) return null;

  const { frontmatter: metadata, sections } = hubData;

  const hasTodo = Object.values(sections).some((content) =>
    />\s*\*\*?TODO:?\*?\s*/i.test(content),
  );

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: metadata.title,
          headerRight: () => (
            <Pressable onPress={handleExport}>
              <FontAwesome
                name="share-square-o"
                size={20}
                color={themeColors.tint}
                style={{ marginRight: 15 }}
              />
            </Pressable>
          ),
        }}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <View
          style={[
            styles.infoCard,
            { backgroundColor: themeColors.cardBackground },
          ]}
        >
          <Text style={styles.description}>{metadata.description}</Text>
          <View style={styles.metaGrid}>
            <MetaItem label="Topic" value={metadata.topic} icon="tag" />
            <MetaItem label="Audience" value={metadata.audience} icon="users" />
            <MetaItem label="Goal" value={metadata.goal} icon="flag" />
            <MetaItem label="Persona" value={metadata.personaId} icon="user" />
          </View>
        </View>

        <Text style={styles.sectionHeader}>Structure & Content</Text>

        {Object.keys(metadata.blueprint).map((sectionId) => {
          const blueprint = metadata.blueprint[sectionId];
          const isExpanded = expandedSection === sectionId;
          const content = sections[sectionId] || "";
          const isTodo = />\s*\*\*?TODO:?\*?\s*/i.test(content);

          return (
            <View
              key={sectionId}
              style={[
                styles.sectionCard,
                { backgroundColor: themeColors.cardBackground },
              ]}
            >
              <Pressable
                onPress={() => toggleSection(sectionId)}
                style={styles.sectionToggle}
              >
                <View style={styles.sectionTitleRow}>
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: isTodo ? "#ffcc00" : "#32a852" },
                    ]}
                  />
                  <Text style={styles.sectionTitle}>{blueprint.header}</Text>
                </View>
                <FontAwesome
                  name={isExpanded ? "chevron-up" : "chevron-down"}
                  size={12}
                  color="#888"
                />
              </Pressable>

              {isExpanded && (
                <View style={styles.expandedContent}>
                  <View style={styles.divider} />
                  <Text style={styles.sectionBody}>
                    {content
                      .replace(/\[SECTION.*?\]|\[\/SECTION\]/g, "")
                      .trim()}
                  </Text>
                </View>
              )}
            </View>
          );
        })}

        <Pressable
          style={[styles.deleteButton, { borderColor: "#ff4444" }]}
          onPress={handleDelete}
        >
          <FontAwesome name="trash" size={16} color="#ff4444" />
          <Text style={styles.deleteButtonText}>Delete Hub</Text>
        </Pressable>
      </ScrollView>

      {hasTodo && (
        <View style={styles.footer}>
          <Pressable
            style={[
              styles.fillButton,
              { backgroundColor: themeColors.buttonPrimary },
            ]}
            onPress={() =>
              router.push({
                pathname: "/hubs/fill",
                params: { id: metadata.hubId },
              })
            }
          >
            <FontAwesome name="magic" size={18} color="#fff" />
            <Text style={styles.fillButtonText}>Fill Empty Sections</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function MetaItem({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentProps<typeof FontAwesome>["name"];
}) {
  return (
    <View style={styles.metaItem}>
      <FontAwesome name={icon} size={10} color="#888" />
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  content: { padding: 20, paddingBottom: 120 },
  infoCard: { padding: 20, borderRadius: 20, marginBottom: 25 },
  description: { fontSize: 16, lineHeight: 22, opacity: 0.8, marginBottom: 20 },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 15,
  },
  metaItem: { width: "45%" },
  metaLabel: {
    fontSize: 10,
    fontWeight: "bold",
    textTransform: "uppercase",
    opacity: 0.4,
    marginLeft: 4,
  },
  metaValue: { fontSize: 14, fontWeight: "600", marginTop: 2 },
  sectionHeader: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
    opacity: 0.6,
  },
  sectionCard: { borderRadius: 16, marginBottom: 10, overflow: "hidden" },
  sectionToggle: {
    padding: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: { fontSize: 15, fontWeight: "700" },
  expandedContent: {
    padding: 18,
    paddingTop: 0,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(128,128,128,0.1)",
    marginBottom: 12,
  },
  sectionBody: { fontSize: 14, lineHeight: 20, opacity: 0.7 },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 30,
    gap: 10,
  },
  deleteButtonText: { color: "#ff4444", fontWeight: "bold" },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
  },
  fillButton: {
    height: 56,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    elevation: 4,
  },
  fillButtonText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
});
