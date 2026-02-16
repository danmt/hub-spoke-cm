// packages/mobile/app/hubs/new.tsx
import { FontAwesome } from "@expo/vector-icons";
import { ConfigService, RegistryService, SecretService } from "@hub-spoke/core";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
} from "react-native";

import { AgentThinkingOverlay } from "@/components/AgentThinkingOverlay";
import { ArchitectProposal } from "@/components/proposals/ArchitectProposal";
import { AssemblerProposal } from "@/components/proposals/AssemblerProposal";
import { ConfirmRetry } from "@/components/proposals/ConfirmRetry";
import { PersonaProposal } from "@/components/proposals/PersonaProposal";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import { Colors } from "@/constants/Colors";
import { useInteractionDeferrer } from "@/hooks/useInteractionDeferrer";
import { executeMobileCreateHubAction } from "@/presets/executeMobileCreateHubAction";
import { useHubs } from "@/services/HubsContext";
import { useWorkspace } from "@/services/WorkspaceContext";
import { WorkspaceManager } from "@/services/WorkspaceManager";
import { Vibe } from "@/utils/vibe";

type ScreenState = "IDLE" | "PROCESSING" | "REVIEWING" | "ERROR" | "DONE";

export default function NewHubScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? "dark";
  const themeColors = Colors[colorScheme];
  const { activeWorkspace, manifest, updateManifest } = useWorkspace();
  const { invalidateCache } = useHubs();
  const { pendingInteraction, ask, handleResolve } = useInteractionDeferrer();
  const [state, setState] = useState<ScreenState>("IDLE");
  const [statusMessage, setStatusMessage] = useState("");
  const [activeAgent, setActiveAgent] = useState<{
    id: string;
    model: string;
    phase?: string;
  } | null>(null);
  const [createdHubId, setCreatedHubId] = useState<string | null>(null);
  const [baseline, setBaseline] = useState({
    topic: "",
    goal: "",
    audience: "",
    language: "English",
  });

  const startGeneration = async () => {
    if (!baseline.topic.trim()) {
      Alert.alert("Required", "Please provide a main topic.");
      return;
    }

    if (!activeWorkspace) {
      Alert.alert("Error", "No active workspace selected.");
      return;
    }

    setState("PROCESSING");
    try {
      const config = await ConfigService.getConfig();
      const secret = await SecretService.getSecret();

      if (!secret.apiKey) {
        throw new Error(
          "Gemini API Key is missing. Please set it in Settings.",
        );
      }

      const workspaceDir = WorkspaceManager.getWorkspaceUri(activeWorkspace);
      const artifacts = await RegistryService.getAllArtifacts(workspaceDir.uri);
      const agents = RegistryService.initializeAgents(
        secret.apiKey,
        config.model!,
        artifacts,
      );
      const registryManifest = RegistryService.toManifest(agents);

      const result = await executeMobileCreateHubAction(
        secret.apiKey,
        config.model!,
        registryManifest,
        baseline,
        agents,
        workspaceDir.uri,
        {
          ask: async (type, data) => {
            await Vibe.handoff(); // Vibrate when agent needs user feedback
            setState("REVIEWING");
            return await ask(type, data);
          },
          onStatus: (msg, agentId, phase) => {
            setState("PROCESSING");
            setStatusMessage(msg);
            setActiveAgent({
              id: agentId || "Architect",
              model: config.model || "gemini-2.0-flash",
              phase: phase || "planning",
            });
          },
          onComplete: async (hubId, title) => {
            const newEntry = {
              id: hubId,
              title: title,
              hasTodo: true,
              lastModified: new Date().toISOString(),
            };
            const currentHubs = manifest?.hubs || [];
            await updateManifest({ hubs: [...currentHubs, newEntry] });
            invalidateCache(hubId);
          },
        },
      );

      setCreatedHubId(result.assembly.blueprint.hubId);
      await Vibe.handoff(); // Success vibration
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
        progressText="Architecting Content Strategy"
        color={themeColors.buttonPrimary}
      />
    );
  }

  if (state === "REVIEWING" && pendingInteraction) {
    const { type, data } = pendingInteraction;
    return (
      <View style={styles.container}>
        {type === "architect" && (
          <ArchitectProposal data={data} onResolve={handleResolve} />
        )}
        {type === "assembler" && (
          <AssemblerProposal data={data} onResolve={handleResolve} />
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
        <Text style={styles.victoryEmoji}>🏗️</Text>
        <Text style={styles.title}>Hub Architected!</Text>
        <Text style={styles.description}>
          Strategy for "{baseline.topic}" is ready. Continue to content
          generation?
        </Text>
        <View style={styles.victoryActions}>
          <Pressable
            style={[
              styles.primaryButton,
              { backgroundColor: themeColors.buttonPrimary },
            ]}
            onPress={() =>
              router.replace({
                pathname: "/hubs/fill",
                params: { id: createdHubId },
              })
            }
          >
            <FontAwesome name="magic" size={18} color="#fff" />
            <Text style={styles.buttonText}>Fill Content Now</Text>
          </Pressable>
          <Pressable
            style={[styles.secondaryButton, { borderColor: themeColors.tint }]}
            onPress={() =>
              router.replace({
                pathname: "/(tabs)/hubs/details",
                params: { id: createdHubId },
              })
            }
          >
            <Text style={{ color: themeColors.tint, fontWeight: "bold" }}>
              View Scaffold
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.formContent}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <FontAwesome name="close" size={20} color={themeColors.text} />
          </Pressable>
          <Text style={styles.title}>New Hub</Text>
        </View>
        <Text style={styles.description}>
          Provide the initial context for the Architect Agent.
        </Text>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Main Topic</Text>
          <TextInput
            style={[
              styles.input,
              { color: themeColors.text, borderColor: themeColors.tint },
            ]}
            value={baseline.topic}
            onChangeText={(t) => setBaseline({ ...baseline, topic: t })}
            placeholder="e.g. React Native Architecture"
            placeholderTextColor="#888"
          />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Goal</Text>
          <TextInput
            style={[
              styles.input,
              { color: themeColors.text, borderColor: themeColors.tint },
            ]}
            value={baseline.goal}
            onChangeText={(g) => setBaseline({ ...baseline, goal: g })}
            placeholder="What should readers learn?"
            placeholderTextColor="#888"
          />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Target Audience</Text>
          <TextInput
            style={[
              styles.input,
              { color: themeColors.text, borderColor: themeColors.tint },
            ]}
            value={baseline.audience}
            onChangeText={(a) => setBaseline({ ...baseline, audience: a })}
            placeholder="Who is this for?"
            placeholderTextColor="#888"
          />
        </View>
        <Pressable
          style={[
            styles.primaryButton,
            { backgroundColor: themeColors.buttonPrimary, marginTop: 20 },
          ]}
          onPress={startGeneration}
        >
          <Text style={styles.buttonText}>Initialize Architect</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
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
  formContent: { padding: 25, paddingTop: 60 },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  backBtn: { marginRight: 20, padding: 5 },
  title: { fontSize: 32, fontWeight: "bold" },
  description: { fontSize: 16, opacity: 0.6, lineHeight: 24, marginBottom: 30 },
  inputGroup: { marginBottom: 25 },
  label: {
    fontSize: 12,
    fontWeight: "bold",
    opacity: 0.5,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  input: { height: 50, borderBottomWidth: 2, fontSize: 18, paddingVertical: 5 },
  primaryButton: {
    height: 60,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    flexDirection: "row",
    gap: 12,
  },
  secondaryButton: {
    height: 60,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    borderWidth: 1,
    marginTop: 12,
  },
  buttonText: { color: "#fff", fontWeight: "bold", fontSize: 18 },
  victoryEmoji: { fontSize: 60, marginBottom: 20 },
  victoryActions: { width: "100%", marginTop: 20 },
});
