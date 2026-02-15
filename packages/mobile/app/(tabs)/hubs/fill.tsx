import { ConfirmRetry } from "@/components/proposals/ConfirmRetry";
import { PersonaProposal } from "@/components/proposals/PersonaProposal";
import { WriterProposal } from "@/components/proposals/WriterProposal";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { useInteractionDeferrer } from "@/hooks/useInteractionDeferrer";
import { executeMobileFillAction } from "@/presets/executeMobileFillAction";
import { ExportService } from "@/services/ExportService";
import { useWorkspace } from "@/services/WorkspaceContext";
import { WorkspaceManager } from "@/services/WorkspaceManager";
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
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
} from "react-native";

type ScreenState = "IDLE" | "PROCESSING" | "REVIEWING" | "ERROR" | "DONE";

export default function FillHubScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activeWorkspace } = useWorkspace();
  const colorScheme = useColorScheme() ?? "light";
  const themeColors = Colors[colorScheme];
  const router = useRouter();

  const { pendingInteraction, ask, handleResolve } = useInteractionDeferrer();

  const [state, setState] = useState<ScreenState>("IDLE");
  const [statusMessage, setStatusMessage] = useState("");
  const [activeAgent, setActiveAgent] = useState<{
    id: string;
    model: string;
  } | null>(null);
  const [hubData, setHubData] = useState<ParsedFile | null>(null);
  const [hubRootDir, setHubRootDir] = useState<string>("");
  const [hubPathUri, setHubPathUri] = useState<string>("");

  const pulseAnim = useMemo(() => new Animated.Value(1), []);

  useEffect(() => {
    if (state === "PROCESSING") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.5,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [state]);

  useEffect(() => {
    async function loadHubForPreview() {
      if (!activeWorkspace || !id) return;
      try {
        const workspaceDir = WorkspaceManager.getWorkspaceUri(activeWorkspace);
        const hubDir = new Directory(workspaceDir, "posts", id);
        const hubFile = new File(hubDir, "hub.md");
        const hub = await IoService.readHub(hubDir.uri);
        setHubData(hub);
        setHubRootDir(hubDir.uri);
        setHubPathUri(hubFile.uri);
      } catch (err: any) {
        setStatusMessage(err.message);
        setState("ERROR");
      }
    }
    loadHubForPreview();
  }, [id, activeWorkspace]);

  const sections = useMemo(() => {
    if (!hubData) return { completed: [], pending: [] };
    const all = Object.keys(hubData.sections);
    const todoRegex = />\s*\*\*?TODO:?\*?\s*(.*)/i;
    return {
      completed: all.filter((s) => !todoRegex.test(hubData.sections[s])),
      pending: all.filter((s) => todoRegex.test(hubData.sections[s])),
    };
  }, [hubData]);

  const startFilling = async () => {
    if (!activeWorkspace || !hubData) return;
    setState("PROCESSING");
    try {
      const config = await ConfigService.getConfig();
      const secret = await SecretService.getSecret();
      const workspaceDir = WorkspaceManager.getWorkspaceUri(activeWorkspace);
      const artifacts = await RegistryService.getAllArtifacts(workspaceDir.uri);
      const agents = RegistryService.initializeAgents(
        secret.apiKey!,
        config.model!,
        artifacts,
      );

      await executeMobileFillAction(
        agents,
        hubData.frontmatter,
        hubData.sections,
        hubPathUri,
        {
          ask: async (type, data) => {
            setState("REVIEWING");
            return await ask(type, data);
          },
          onStatus: (msg) => {
            setState("PROCESSING");
            setStatusMessage(msg);
            // Extract Agent ID if possible from message or use frontmatter
            setActiveAgent({
              id: hubData.frontmatter.personaId,
              model: config.model!,
            });
          },
        },
      );
      setState("DONE");
    } catch (err: any) {
      setStatusMessage(err.message);
      setState("ERROR");
    }
  };

  if (!hubData && state === "IDLE") {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={themeColors.tint} />
      </View>
    );
  }

  if (state === "DONE") {
    return (
      <View style={styles.centered}>
        <Text style={styles.victoryEmoji}>🎉</Text>
        <Text style={styles.title}>Generation Complete</Text>
        <Text style={styles.description}>
          Your content hub has been personified and filled.
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

          <Pressable
            style={[styles.secondaryButton, { borderColor: themeColors.tint }]}
            onPress={() => ExportService.exportHub(hubRootDir)}
          >
            <FontAwesome name="share" size={16} color={themeColors.tint} />
            <Text
              style={{
                color: themeColors.tint,
                fontWeight: "bold",
                marginLeft: 8,
              }}
            >
              Export / Share
            </Text>
          </Pressable>

          <Pressable onPress={() => router.replace("/hubs")}>
            <Text style={{ marginTop: 20, opacity: 0.5, fontWeight: "600" }}>
              Back to List
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (state === "IDLE" && hubData) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.idleContent}>
          <Text style={styles.title}>Fill Hub</Text>
          <View style={styles.personaBadge}>
            <Text style={styles.personaBadgeText}>
              Styling with: {hubData.frontmatter.personaId}
            </Text>
          </View>

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

          <Text style={styles.sectionHeader}>Pending Items</Text>
          {sections.pending.map((sid) => (
            <View key={sid} style={styles.queueItem}>
              <FontAwesome name="circle-o" size={14} color="#ffcc00" />
              <Text style={styles.queueText}>
                {hubData.frontmatter.blueprint[sid].header}
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
          >
            <Text style={styles.btnText}>Start Filling</Text>
          </Pressable>
        </View>
      </View>
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

  return (
    <View style={styles.container}>
      <View style={styles.processingContent}>
        {activeAgent && (
          <View style={styles.agentWatermark}>
            <FontAwesome name="bolt" size={10} color={themeColors.tint} />
            <Text style={styles.agentWatermarkText}>
              {activeAgent.id} | {activeAgent.model}
            </Text>
          </View>
        )}
        <ActivityIndicator size="large" color={themeColors.tint} />
        <Animated.Text style={[styles.statusText, { opacity: pulseAnim }]}>
          {statusMessage}
        </Animated.Text>
      </View>
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
  idleContent: { padding: 25, paddingTop: 60 },
  title: { fontSize: 28, fontWeight: "bold", marginBottom: 10 },
  description: {
    fontSize: 16,
    opacity: 0.6,
    lineHeight: 24,
    marginBottom: 30,
    textAlign: "center",
  },
  personaBadge: {
    backgroundColor: "rgba(50, 168, 82, 0.15)",
    padding: 10,
    borderRadius: 10,
    marginBottom: 20,
    alignSelf: "flex-start",
  },
  personaBadgeText: { color: "#32a852", fontWeight: "bold", fontSize: 12 },
  statsGrid: { flexDirection: "row", gap: 15, marginBottom: 30 },
  statBox: { flex: 1, padding: 15, borderRadius: 16, alignItems: "center" },
  statNum: { fontSize: 24, fontWeight: "bold" },
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
    gap: 10,
    marginBottom: 12,
  },
  queueText: { fontSize: 15, fontWeight: "500", opacity: 0.7 },
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
  },
  secondaryButton: {
    height: 56,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    flexDirection: "row",
    width: "100%",
    marginTop: 12,
  },
  btnText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  processingContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  statusText: {
    marginTop: 20,
    fontSize: 16,
    textAlign: "center",
    fontWeight: "600",
  },
  agentWatermark: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(128,128,128,0.1)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 30,
  },
  agentWatermarkText: {
    fontSize: 10,
    fontWeight: "bold",
    marginLeft: 6,
    opacity: 0.6,
  },
  victoryEmoji: { fontSize: 60, marginBottom: 20 },
  victoryActions: { width: "100%", marginTop: 30 },
});
