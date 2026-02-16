// packages/mobile/app/(tabs)/agents/[id].tsx
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import { Colors, ThemeColors } from "@/constants/Colors";
import { useAgents } from "@/services/AgentsContext";
import { FontAwesome } from "@expo/vector-icons";
import {
  AssemblerArtifact,
  PersonaArtifact,
  WriterArtifact,
} from "@hub-spoke/core";
import { Stack, useLocalSearchParams } from "expo-router";
import React, { useMemo } from "react";
import { ScrollView, StyleSheet } from "react-native";

export default function AgentDetailsScreen() {
  const { id, type } = useLocalSearchParams<{ id: string; type: any }>();
  const { getAgent } = useAgents();
  const themeColors = Colors[useColorScheme() ?? "dark"];

  const agent = useMemo(() => getAgent(type, id), [id, type, getAgent]);

  if (!agent) {
    return (
      <View style={styles.centered}>
        <Text>Agent not found.</Text>
      </View>
    );
  }

  const artifact = agent.artifact;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: artifact.id }} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Polymorphic Body */}
        {artifact.type === "persona" && (
          <PersonaDisplay artifact={artifact} theme={themeColors} />
        )}
        {artifact.type === "writer" && (
          <WriterDisplay artifact={artifact} theme={themeColors} />
        )}
        {artifact.type === "assembler" && (
          <AssemblerDisplay artifact={artifact} theme={themeColors} />
        )}

        {/* System Instructions Section */}
        <Text style={styles.sectionTitle}>System Prompt</Text>
        <View
          style={[
            styles.contentCard,
            { backgroundColor: themeColors.cardBackground },
          ]}
        >
          <Text style={styles.contentBody}>{artifact.content}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

/**
 * Specialized UI for Personas - Focuses on Voice & Style
 */
function PersonaDisplay({
  artifact,
  theme,
}: {
  artifact: PersonaArtifact;
  theme: ThemeColors;
}) {
  return (
    <>
      <View
        style={[styles.headerCard, { backgroundColor: theme.cardBackground }]}
      >
        <Text style={styles.typeLabel}>Persona</Text>
        <Text style={styles.title}>{artifact.name}</Text>
        <Text style={styles.description}>{artifact.description}</Text>
      </View>

      <View style={styles.metaSection}>
        <Text style={styles.sectionTitle}>Voice Profile</Text>
        <View style={styles.row}>
          <InfoTile
            icon="volume-up"
            label="Tone"
            value={artifact.tone}
            theme={theme}
          />
          <InfoTile
            icon="language"
            label="Lang"
            value={artifact.language}
            theme={theme}
          />
          <InfoTile
            icon="commenting-o"
            label="Accent"
            value={artifact.accent}
            theme={theme}
          />
        </View>
      </View>
    </>
  );
}

/**
 * Specialized UI for Writers - Focuses on Technical Strategy
 */
function WriterDisplay({
  artifact,
  theme,
}: {
  artifact: WriterArtifact;
  theme: ThemeColors;
}) {
  return (
    <>
      <View
        style={[styles.headerCard, { backgroundColor: theme.cardBackground }]}
      >
        <Text style={styles.typeLabel}>Writer</Text>
        <Text style={styles.title}>{artifact.id}</Text>
        <Text style={styles.description}>{artifact.description}</Text>
      </View>

      <View style={styles.metaSection}>
        <Text style={styles.sectionTitle}>Drafting Strategy</Text>
        <View style={[styles.strategyCard, { borderColor: theme.tint + "40" }]}>
          <FontAwesome name="terminal" size={14} color={theme.tint} />
          <Text style={styles.strategyText}>
            This agent handles neutral technical drafting without stylistic
            bias.
          </Text>
        </View>
      </View>
    </>
  );
}

/**
 * Specialized UI for Assemblers - Focuses on Structure & Dependencies
 */
function AssemblerDisplay({
  artifact,
  theme,
}: {
  artifact: AssemblerArtifact;
  theme: ThemeColors;
}) {
  return (
    <>
      <View
        style={[styles.headerCard, { backgroundColor: theme.cardBackground }]}
      >
        <Text style={styles.typeLabel}>Assembler</Text>
        <Text style={styles.title}>{artifact.id}</Text>
        <Text style={styles.description}>{artifact.description}</Text>
      </View>

      <View style={styles.metaSection}>
        <Text style={styles.sectionTitle}>Orchestration Chain</Text>
        <Text style={styles.label}>Supported Writers:</Text>
        <View style={styles.tagRow}>
          {artifact.writerIds?.map((wId: string) => (
            <View
              key={wId}
              style={[styles.tag, { backgroundColor: theme.tint + "20" }]}
            >
              <Text style={[styles.tagText, { color: theme.tint }]}>{wId}</Text>
            </View>
          ))}
        </View>
      </View>
    </>
  );
}

function InfoTile({
  icon,
  label,
  value,
  theme,
}: {
  icon: React.ComponentProps<typeof FontAwesome>["name"];
  label: string;
  value: string;
  theme: ThemeColors;
}) {
  return (
    <View style={[styles.tile, { backgroundColor: theme.cardBackground }]}>
      <FontAwesome
        name={icon}
        size={16}
        color={theme.tint}
        style={{ marginBottom: 6 }}
      />
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  scrollContent: { padding: 20, paddingBottom: 40 },
  headerCard: { padding: 25, borderRadius: 24, marginBottom: 25 },
  typeLabel: {
    fontSize: 10,
    fontWeight: "900",
    opacity: 0.4,
    marginBottom: 8,
    letterSpacing: 1,
  },
  title: { fontSize: 28, fontWeight: "bold", marginBottom: 12 },
  description: { fontSize: 16, lineHeight: 22, opacity: 0.8 },
  metaSection: { marginBottom: 25 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "900",
    textTransform: "uppercase",
    opacity: 0.4,
    marginBottom: 15,
    letterSpacing: 1,
  },
  row: { flexDirection: "row", gap: 10 },
  tile: { flex: 1, padding: 15, borderRadius: 16, alignItems: "flex-start" },
  tileLabel: {
    fontSize: 10,
    fontWeight: "bold",
    opacity: 0.4,
    textTransform: "uppercase",
  },
  tileValue: { fontSize: 14, fontWeight: "bold", marginTop: 4 },
  strategyCard: {
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  strategyText: { fontSize: 13, opacity: 0.7, flex: 1 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  tag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  tagText: { fontSize: 12, fontWeight: "bold" },
  label: { fontSize: 12, fontWeight: "bold", opacity: 0.6 },
  contentCard: { padding: 20, borderRadius: 20 },
  contentBody: {
    fontSize: 14,
    lineHeight: 22,
    fontStyle: "italic",
    opacity: 0.7,
  },
});
