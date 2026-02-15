// packages/mobile/app/hubs/fill.tsx
import { AgentThinkingOverlay } from "@/components/AgentThinkingOverlay";
import { ConfirmRetry } from "@/components/proposals/ConfirmRetry";
import { PersonaProposal } from "@/components/proposals/PersonaProposal";
import { WriterProposal } from "@/components/proposals/WriterProposal";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { useInteractionDeferrer } from "@/hooks/useInteractionDeferrer";
import { executeMobileFillAction } from "@/presets/executeMobileFillAction";
import { useWorkspace } from "@/services/WorkspaceContext";
import { WorkspaceManager } from "@/services/WorkspaceManager";
import { Vibe } from "@/utils/vibe";
import { FontAwesome } from "@expo/vector-icons";
import {
  ConfigService,
  IoService,
  ParsedFile,
  RegistryService,
  SecretService,
} from "@hub-spoke/core";
import { Directory, File } from "expo-file-system";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
} from "react-native";

type ScreenState = "IDLE" | "PROCESSING" | "REVIEWING" | "ERROR" | "DONE";

const TODO_REGEX = />\s*\*\*?TODO:?\*?\s*(.*)/i;

export default function FillHubScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activeWorkspace } = useWorkspace();
  const themeColors = Colors[useColorScheme() ?? "light"];
  const router = useRouter();

  const { pendingInteraction, ask, handleResolve } = useInteractionDeferrer();

  const [state, setState] = useState<ScreenState>("IDLE");
  const [statusMessage, setStatusMessage] = useState("");
  const [activeAgent, setActiveAgent] = useState<{
    id: string;
    model: string;
    phase?: string;
  } | null>(null);
  const [hubData, setHubData] = useState<ParsedFile | null>(null);
  const [hubPathUri, setHubPathUri] = useState<string>("");

  useEffect(() => {
    async function loadHub() {
      if (!activeWorkspace || !id) return;
      try {
        const workspaceDir = WorkspaceManager.getWorkspaceUri(activeWorkspace);
        const hubDir = new Directory(workspaceDir, "posts", id);
        const hub = await IoService.readHub(hubDir.uri);
        setHubData(hub);
        setHubPathUri(new File(hubDir, "hub.md").uri);
      } catch (err: any) {
        setStatusMessage("Failed to load hub data.");
        setState("ERROR");
      }
    }
    loadHub();
  }, [id, activeWorkspace]);

  const sections = useMemo(() => {
    if (!hubData) return { completed: [], pending: [] };
    const allIds = Object.keys(hubData.sections);
    return {
      completed: allIds.filter(
        (sid) => !TODO_REGEX.test(hubData.sections[sid]),
      ),
      pending: allIds.filter((sid) => TODO_REGEX.test(hubData.sections[sid])),
    };
  }, [hubData]);

  const startFilling = async () => {
    if (!activeWorkspace || !hubData) return;

    // Lock into processing state immediately
    setState("PROCESSING");
    setStatusMessage("Initializing AI Orchestrator...");

    try {
      const config = await ConfigService.getConfig();
      const secret = await SecretService.getSecret();
      const workspaceDir = WorkspaceManager.getWorkspaceUri(activeWorkspace);
      const agents = RegistryService.initializeAgents(
        secret.apiKey!,
        config.model!,
        await RegistryService.getAllArtifacts(workspaceDir.uri),
      );

      await executeMobileFillAction(
        agents,
        hubData.frontmatter,
        hubData.sections,
        hubPathUri,
        {
          ask: async (type, data) => {
            await Vibe.handoff();
            setState("REVIEWING");
            const response = await ask(type, data);

            // Critical: Immediately set back to PROCESSING after approval
            // This prevents the screen from bouncing back to IDLE
            setState("PROCESSING");
            setStatusMessage("Submitting approval...");

            return response;
          },
          onStatus: (msg, agentId, phase) => {
            // Ensure we are in PROCESSING even if coming from a callback
            setState("PROCESSING");
            setStatusMessage(msg);
            if (agentId) {
              setActiveAgent({ id: agentId, model: config.model!, phase });
            }
          },
        },
      );

      await Vibe.handoff();
      setState("DONE");
    } catch (err: any) {
      setStatusMessage(err.message);
      setState("ERROR");
    }
  };

  if (state === "PROCESSING" && activeAgent) {
    return (
      <AgentThinkingOverlay
        agentId={activeAgent.id}
        model={activeAgent.model}
        phase={activeAgent.phase}
        status={statusMessage}
        progressText={`${sections.pending.length} SECTIONS REMAINING`}
        color={activeAgent.phase === "styling" ? "#a832a4" : themeColors.tint}
      />
    );
  }

  if (state === "REVIEWING" && pendingInteraction) {
    const { type, data } = pendingInteraction;
    return (
      <View style={styles.container}>
        {type === "writer" && (
          <WriterProposal data={data} onResolve={handleResolve} />
        )}
        {type === "persona" && (
          <PersonaProposal data={data} onResolve={handleResolve} />
        )}
        {type === "retry" && (
          <ConfirmRetry error={data} onRetry={handleResolve} />
        )}
      </View>
    );
  }

  if (state === "DONE") {
    return (
      <View style={styles.centered}>
        <Text style={styles.victoryEmoji}>🎉</Text>
        <Text style={styles.title}>Generation Complete</Text>
        <Text style={styles.description}>
          All sections have been drafted and styled.
        </Text>
        <View style={styles.victoryActions}>
          <Pressable
            style={[
              styles.primaryButton,
              { backgroundColor: themeColors.buttonPrimary },
            ]}
            onPress={() =>
              router.replace({
                pathname: "/(tabs)/hubs/details",
                params: { id: hubData?.frontmatter.hubId },
              })
            }
          >
            <Text style={styles.btnText}>View Finished Hub</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {hubData ? (
        <View style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.idleContent}>
            <View style={styles.headerRow}>
              <Pressable onPress={() => router.back()} style={styles.backBtn}>
                <FontAwesome name="close" size={20} color={themeColors.text} />
              </Pressable>
              <Text style={styles.title}>Fill Hub</Text>
            </View>
            <View style={styles.personaBadge}>
              <Text style={styles.personaBadgeText}>
                Style Agent: {hubData.frontmatter.personaId}
              </Text>
            </View>
            <Text style={styles.description}>
              Populating sections marked with TODOs using your specialized
              agents.
            </Text>
            <View style={styles.statsGrid}>
              <View
                style={[
                  styles.statBox,
                  { backgroundColor: themeColors.cardBackground },
                ]}
              >
                <Text style={styles.statNum}>{sections.completed.length}</Text>
                <Text style={styles.statLab}>Completed</Text>
              </View>
              <View
                style={[
                  styles.statBox,
                  { backgroundColor: themeColors.cardBackground },
                ]}
              >
                <Text style={[styles.statNum, { color: "#ffcc00" }]}>
                  {sections.pending.length}
                </Text>
                <Text style={styles.statLab}>Pending</Text>
              </View>
            </View>
            <Text style={styles.sectionHeader}>Queue</Text>
            {sections.pending.map((sid) => (
              <View key={sid} style={styles.queueItem}>
                <FontAwesome name="circle-o" size={14} color="#ffcc00" />
                <Text style={styles.queueText}>
                  {hubData.frontmatter.blueprint[sid]?.header || sid}
                </Text>
              </View>
            ))}
          </ScrollView>
          <View style={styles.footer}>
            <Pressable
              style={[
                styles.primaryButton,
                { backgroundColor: themeColors.buttonPrimary },
              ]}
              onPress={startFilling}
              disabled={sections.pending.length === 0}
            >
              <FontAwesome name="bolt" size={18} color="#fff" />
              <Text style={styles.btnText}>Start AI Orchestration</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={themeColors.tint} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  idleContent: { padding: 25, paddingTop: 60, paddingBottom: 100 },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 15 },
  backBtn: { marginRight: 20, padding: 5 },
  title: { fontSize: 28, fontWeight: "bold" },
  description: { fontSize: 15, opacity: 0.6, lineHeight: 22, marginBottom: 25 },
  personaBadge: {
    backgroundColor: "rgba(50, 168, 82, 0.1)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: "flex-start",
    marginBottom: 15,
  },
  personaBadgeText: { color: "#32a852", fontWeight: "bold", fontSize: 12 },
  statsGrid: { flexDirection: "row", gap: 15, marginBottom: 30 },
  statBox: { flex: 1, padding: 15, borderRadius: 16, alignItems: "center" },
  statNum: { fontSize: 22, fontWeight: "bold" },
  statLab: {
    fontSize: 10,
    opacity: 0.5,
    textTransform: "uppercase",
    marginTop: 4,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
    opacity: 0.8,
  },
  queueItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "rgba(128,128,128,0.05)",
  },
  queueText: { fontSize: 15, fontWeight: "500", opacity: 0.8 },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "rgba(128,128,128,0.1)",
  },
  primaryButton: {
    height: 56,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    flexDirection: "row",
    gap: 12,
  },
  btnText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  victoryEmoji: { fontSize: 60, marginBottom: 20 },
  victoryActions: { width: "100%", marginTop: 20 },
});
