import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { useWorkspace } from "@/services/WorkspaceContext";
import { FontAwesome } from "@expo/vector-icons";
import {
  Artifact,
  AssemblerArtifact,
  PersonaArtifact,
  RegistryService,
} from "@hub-spoke/core";
import React, { useMemo, useState } from "react";
import {
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  UIManager,
} from "react-native";

// Enable LayoutAnimation for Android
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function AgentsScreen() {
  const { activeWorkspace } = useWorkspace();
  const colorScheme = useColorScheme() ?? "light";
  const themeColors = Colors[colorScheme];

  const groupedAgents = useMemo(() => {
    const cached = RegistryService.getCachedArtifacts();
    return {
      personas: cached.filter((a) => a.type === "persona") as PersonaArtifact[],
      writers: cached.filter((a) => a.type === "writer"),
      assemblers: cached.filter(
        (a) => a.type === "assembler",
      ) as AssemblerArtifact[],
    };
  }, [activeWorkspace]);

  if (!activeWorkspace) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>Select a workspace to view agents.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 60 }}
    >
      <Section
        title="Personas"
        icon="user-circle"
        agents={groupedAgents.personas}
        themeColors={themeColors}
        type="persona"
      />
      <Section
        title="Writers"
        icon="pencil"
        agents={groupedAgents.writers}
        themeColors={themeColors}
        type="writer"
      />
      <Section
        title="Assemblers"
        icon="tasks"
        agents={groupedAgents.assemblers}
        themeColors={themeColors}
        type="assembler"
      />
    </ScrollView>
  );
}

function Section({ title, icon, agents, themeColors, type }: any) {
  if (agents.length === 0) return null;
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <FontAwesome name={icon} size={16} color={themeColors.tint} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {agents.map((agent: Artifact) => (
        <AgentCard
          key={agent.id}
          agent={agent}
          themeColors={themeColors}
          type={type}
        />
      ))}
    </View>
  );
}

function AgentCard({
  agent,
  themeColors,
  type,
}: {
  agent: any;
  themeColors: any;
  type: string;
}) {
  const [expanded, setExpanded] = useState(false);

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  return (
    <View
      style={[styles.card, { backgroundColor: themeColors.cardBackground }]}
    >
      <Pressable onPress={toggleExpand} style={styles.cardPressable}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1, backgroundColor: "transparent" }}>
            <Text style={styles.agentName}>{agent.name || agent.id}</Text>
            <Text style={[styles.agentId, { color: themeColors.tint }]}>
              @{agent.id}
            </Text>
          </View>
          <FontAwesome
            name={expanded ? "chevron-up" : "chevron-down"}
            size={12}
            color="#888"
          />
        </View>

        <Text style={styles.agentDescription}>{agent.description}</Text>

        {/* Specialized Metadata Rendering */}
        <View style={styles.metaContainer}>
          {type === "persona" && (
            <View style={styles.tagRow}>
              <Badge label="Tone" value={agent.tone} color={themeColors.tint} />
              <Badge
                label="Language"
                value={agent.language}
                color={themeColors.tint}
              />
              <Badge
                label="Accent"
                value={agent.accent}
                color={themeColors.tint}
              />
            </View>
          )}

          {type === "assembler" && (
            <View style={styles.tagRow}>
              <Text style={styles.metaLabel}>Writers:</Text>
              {agent.writerIds?.map((wId: string) => (
                <View key={wId} style={styles.miniBadge}>
                  <Text style={styles.miniBadgeText}>{wId}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Collapsible Content Section */}
        {expanded && (
          <View style={styles.expandedContent}>
            <View style={styles.divider} />
            <Text style={styles.contentLabel}>SYSTEM INSTRUCTIONS</Text>
            <Text style={styles.contentBody}>{agent.content}</Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

function Badge({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View style={[styles.badge, { borderColor: color + "40" }]}>
      <Text style={[styles.badgeText, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  section: { marginBottom: 35 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
    backgroundColor: "transparent",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginLeft: 10,
    opacity: 0.5,
  },
  card: {
    borderRadius: 20,
    marginBottom: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(128,128,128,0.08)",
  },
  cardPressable: { padding: 20 },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
    backgroundColor: "transparent",
  },
  agentName: { fontSize: 19, fontWeight: "bold" },
  agentId: { fontSize: 12, fontWeight: "700", marginTop: 2 },
  agentDescription: {
    fontSize: 14,
    opacity: 0.7,
    lineHeight: 20,
    marginBottom: 15,
  },
  metaContainer: { backgroundColor: "transparent" },
  metaLabel: {
    fontSize: 11,
    fontWeight: "bold",
    opacity: 0.4,
    marginRight: 8,
    textTransform: "uppercase",
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    alignItems: "center",
    backgroundColor: "transparent",
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  badgeText: { fontSize: 11, fontWeight: "bold" },
  miniBadge: {
    backgroundColor: "rgba(128,128,128,0.1)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  miniBadgeText: { fontSize: 10, fontWeight: "600", opacity: 0.8 },
  expandedContent: { marginTop: 15, backgroundColor: "transparent" },
  divider: {
    height: 1,
    backgroundColor: "rgba(128,128,128,0.1)",
    marginBottom: 15,
  },
  contentLabel: {
    fontSize: 10,
    fontWeight: "900",
    opacity: 0.3,
    marginBottom: 8,
    letterSpacing: 1,
  },
  contentBody: {
    fontSize: 13,
    lineHeight: 20,
    fontStyle: "italic",
    opacity: 0.8,
  },
  emptyText: { opacity: 0.5 },
});
