// packages/mobile/app/(tabs)/hubs/fill.tsx
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { useInteractionDeferrer } from "@/hooks/useInteractionDeferrer";
import { executeMobileFillAction } from "@/presets/executeMobileFillAction";
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
  Pressable,
  ScrollView,
  StyleSheet,
} from "react-native";

import { ConfirmRetry } from "@/components/proposals/ConfirmRetry";
import { PersonaProposal } from "@/components/proposals/PersonaProposal";
import { WriterProposal } from "@/components/proposals/WriterProposal";

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
  const [hubData, setHubData] = useState<ParsedFile | null>(null);
  const [hubPathUri, setHubPathUri] = useState<string>("");

  const TODO_REGEX = />\s*\*\*?TODO:?\*?\s*(.*)/i;

  // Initial Load: Just get the data for preview
  useEffect(() => {
    async function loadHubForPreview() {
      if (!activeWorkspace || !id) return;
      try {
        const workspaceDir = WorkspaceManager.getWorkspaceUri(activeWorkspace);
        const hubDir = new Directory(workspaceDir, "posts", id);
        const hubFile = new File(hubDir, "hub.md");

        const hub = await IoService.readHub(hubDir.uri);
        setHubData(hub);
        setHubPathUri(hubFile.uri);
      } catch (err: any) {
        setStatusMessage(err.message);
        setState("ERROR");
      }
    }
    loadHubForPreview();
  }, [id, activeWorkspace]);

  const pendingSections = useMemo(() => {
    if (!hubData) return [];
    return Object.keys(hubData.sections).filter((sid) =>
      TODO_REGEX.test(hubData.sections[sid]),
    );
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
          },
        },
      );

      setState("DONE");
      setTimeout(() => router.back(), 1500);
    } catch (err: any) {
      setStatusMessage(err.message);
      setState("ERROR");
    }
  };

  // 1. Loading state for initial data fetch
  if (!hubData && state === "IDLE") {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={themeColors.tint} />
      </View>
    );
  }

  // 2. IDLE: Preview state
  if (state === "IDLE" && hubData) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.idleContent}>
          <Text style={styles.title}>Fill Hub</Text>
          <Text style={styles.description}>
            The AI will generate content for {pendingSections.length} pending
            sections using the {hubData.frontmatter.personaId} persona.
          </Text>

          <View
            style={[
              styles.previewCard,
              { backgroundColor: themeColors.cardBackground },
            ]}
          >
            <Text style={styles.previewLabel}>TOPIC</Text>
            <Text style={styles.previewValue}>{hubData.frontmatter.topic}</Text>
            <Text style={styles.previewLabel}>GOAL</Text>
            <Text style={styles.previewValue}>{hubData.frontmatter.goal}</Text>
          </View>

          <Text style={styles.sectionHeader}>Queue</Text>
          {pendingSections.map((sid) => (
            <View key={sid} style={styles.queueItem}>
              <FontAwesome name="clock-o" size={14} color={themeColors.tint} />
              <Text style={styles.queueText}>
                {hubData.frontmatter.blueprint[sid].header}
              </Text>
            </View>
          ))}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            style={[styles.secondaryButton, { borderColor: themeColors.tint }]}
            onPress={() => router.back()}
          >
            <Text style={{ color: themeColors.tint, fontWeight: "bold" }}>
              Cancel
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.primaryButton,
              { backgroundColor: themeColors.buttonPrimary },
            ]}
            onPress={startFilling}
          >
            <Text style={styles.btnText}>Start Generation</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // 3. Reviewing Interaction state
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

  // 4. Processing / Done / Error state
  return (
    <View style={styles.container}>
      <View style={styles.processingContent}>
        {state === "PROCESSING" && (
          <ActivityIndicator size="large" color={themeColors.tint} />
        )}
        {state === "DONE" && <Text style={{ fontSize: 40 }}>✅</Text>}
        <Text style={styles.statusText}>
          {state === "DONE" ? "Hub successfully filled!" : statusMessage}
        </Text>
        {state === "ERROR" && (
          <Pressable
            style={[
              styles.primaryButton,
              {
                backgroundColor: themeColors.buttonPrimary,
                marginTop: 20,
                width: "100%",
              },
            ]}
            onPress={() => router.back()}
          >
            <Text style={styles.btnText}>Go Back</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  idleContent: { padding: 25, paddingTop: 60 },
  title: { fontSize: 32, fontWeight: "bold", marginBottom: 10 },
  description: { fontSize: 16, opacity: 0.6, lineHeight: 24, marginBottom: 30 },
  previewCard: { padding: 20, borderRadius: 16, marginBottom: 30 },
  previewLabel: {
    fontSize: 10,
    fontWeight: "bold",
    opacity: 0.4,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  previewValue: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 15,
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
    flexDirection: "row",
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(128,128,128,0.1)",
  },
  primaryButton: {
    flex: 2,
    height: 56,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButton: {
    flex: 1,
    height: 56,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
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
    opacity: 0.8,
  },
});
