// packages/mobile/app/(tabs)/agents.tsx
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import { Colors } from "@/constants/Colors";
import { useWorkspace } from "@/services/WorkspaceContext";
import { AgentIndexEntry } from "@/types/manifest";
import { FontAwesome } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
} from "react-native";

export default function AgentsScreen() {
  const { manifest, isLoading } = useWorkspace();
  const themeColors = Colors[useColorScheme() ?? "dark"];
  const router = useRouter();

  if (isLoading || !manifest) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="small" color={themeColors.tint} />
      </View>
    );
  }

  const grouped = {
    personas: manifest.agents.filter((a) => a.type === "persona"),
    writers: manifest.agents.filter((a) => a.type === "writer"),
    assemblers: manifest.agents.filter((a) => a.type === "assembler"),
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      <AgentSection
        title="Personas"
        icon="user-circle"
        data={grouped.personas}
        theme={themeColors}
        router={router}
      />
      <AgentSection
        title="Writers"
        icon="pencil"
        data={grouped.writers}
        theme={themeColors}
        router={router}
      />
      <AgentSection
        title="Assemblers"
        icon="tasks"
        data={grouped.assemblers}
        theme={themeColors}
        router={router}
      />
    </ScrollView>
  );
}

function AgentSection({ title, icon, data, theme, router }: any) {
  if (data.length === 0) return null;
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <FontAwesome name={icon} size={14} color={theme.tint} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {data.map((item: AgentIndexEntry) => (
        <Pressable
          key={item.id}
          style={[styles.agentCard, { backgroundColor: theme.cardBackground }]}
          onPress={() =>
            router.push({
              pathname: "/agents/[id]",
              params: { id: item.id, type: item.type },
            })
          }
        >
          <View style={styles.cardInfo}>
            <Text style={styles.agentName}>{item.name || item.id}</Text>
            <Text style={styles.agentDesc} numberOfLines={2}>
              {item.description}
            </Text>
          </View>
          <FontAwesome name="chevron-right" size={12} color="#888" />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  section: { marginBottom: 30 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    opacity: 0.5,
    letterSpacing: 1,
  },
  agentCard: {
    padding: 20,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  cardInfo: { flex: 1, backgroundColor: "transparent" },
  agentName: { fontSize: 17, fontWeight: "bold", marginBottom: 4 },
  agentDesc: { fontSize: 13, opacity: 0.6, lineHeight: 18 },
});
