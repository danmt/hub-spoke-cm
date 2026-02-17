// packages/mobile/app/hubs/new.tsx
import { FontAwesome } from "@expo/vector-icons";
import { ConfigService, RegistryService, SecretService } from "@hub-spoke/core";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
} from "react-native";

import { AgentThinkingOverlay } from "@/components/AgentThinkingOverlay";
import { InputField } from "@/components/form/InputField";
import { ArchitectProposal } from "@/components/proposals/ArchitectProposal";
import { AssemblerProposal } from "@/components/proposals/AssemblerProposal";
import { ConfirmRetry } from "@/components/proposals/ConfirmRetry";
import { PersonaProposal } from "@/components/proposals/PersonaProposal";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import { Colors } from "@/constants/Colors";
import { useInteractionDeferrer } from "@/hooks/useInteractionDeferrer";
import { executeMobileCreateHubAction } from "@/presets/executeMobileCreateHubAction";
import { useAgents } from "@/services/AgentsContext";
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
  const { agents, isLoading: agentsLoading } = useAgents();
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

  useEffect(() => {
    async function checkPrerequisites() {
      const secret = await SecretService.getSecret();
      if (!secret.apiKey) {
        setStatusMessage(
          "Gemini API Key is missing. Please set it in Settings > Secrets.",
        );
        setState("ERROR");
        return;
      }

      if (!agentsLoading) {
        if (agents.length > 0) {
          try {
            RegistryService.validateIntegrity(agents);
          } catch (err: any) {
            setStatusMessage(err.message);
            setState("ERROR");
          }
        } else if (activeWorkspace) {
          setStatusMessage("No agents discovered in the current workspace.");
          setState("ERROR");
        }
      }
    }

    checkPrerequisites();
  }, [agents, agentsLoading, activeWorkspace]);

  /**
   * Validates that all required inputs and credentials are ready.
   */
  const validateBaseline = async (): Promise<boolean> => {
    if (!baseline.topic.trim()) {
      Alert.alert(
        "Required Field",
        "Please provide a main topic for the content hub.",
      );
      return false;
    }
    if (!baseline.goal.trim()) {
      Alert.alert(
        "Required Field",
        "Please specify the goal readers should achieve.",
      );
      return false;
    }
    if (!baseline.audience.trim()) {
      Alert.alert(
        "Required Field",
        "Please define who the target audience is.",
      );
      return false;
    }

    return true;
  };

  const startGeneration = async () => {
    const isValid = await validateBaseline();
    if (!isValid) return;

    setState("PROCESSING");
    try {
      const config = await ConfigService.getConfig();
      const secret = await SecretService.getSecret();

      const workspaceDir = WorkspaceManager.getWorkspaceUri(activeWorkspace);
      const registryManifest = RegistryService.toManifest(agents);

      const result = await executeMobileCreateHubAction(
        secret.apiKey!,
        config.model!,
        registryManifest,
        baseline,
        agents,
        workspaceDir.uri,
        {
          ask: async (type, data) => {
            await Vibe.handoff();
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
      await Vibe.handoff();
      setState("DONE");
    } catch (err: any) {
      setStatusMessage(err.message);
      setState("ERROR");
    }
  };

  const handleViewHubDetails = () => {
    router.dismissAll();
    router.navigate({
      pathname: "/(tabs)/hubs/details",
      params: { id: createdHubId },
    });
  };

  const handleGoToRegistry = () => {
    router.dismissAll();
    router.navigate("/(tabs)/agents");
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

  if (state === "ERROR") {
    return (
      <View style={styles.centered}>
        <FontAwesome name="exclamation-triangle" size={60} color="#ff4444" />
        <Text style={[styles.title, { marginTop: 20 }]}>Registry Conflict</Text>
        <Text style={[styles.description, { textAlign: "center" }]}>
          {statusMessage}
        </Text>
        <View style={styles.victoryActions}>
          <Pressable
            style={[
              styles.primaryButton,
              { backgroundColor: themeColors.buttonPrimary },
            ]}
            onPress={handleGoToRegistry}
          >
            <FontAwesome name="users" size={18} color="#fff" />
            <Text style={styles.buttonText}>Manage Agents</Text>
          </Pressable>
          <Pressable
            style={[styles.secondaryButton, { borderColor: themeColors.tint }]}
            onPress={() => router.back()}
          >
            <Text style={{ color: themeColors.tint, fontWeight: "bold" }}>
              Go Back
            </Text>
          </Pressable>
        </View>
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
            onPress={handleViewHubDetails}
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

        <InputField
          label="Main Topic"
          value={baseline.topic}
          onChangeText={(t) => setBaseline({ ...baseline, topic: t })}
          placeholder="e.g. React Native Architecture"
          required
          autoCapitalize="sentences"
        />

        <InputField
          label="Goal"
          value={baseline.goal}
          onChangeText={(g) => setBaseline({ ...baseline, goal: g })}
          placeholder="What should readers learn?"
          required
          multiline
          numberOfLines={2}
        />

        <InputField
          label="Target Audience"
          value={baseline.audience}
          onChangeText={(a) => setBaseline({ ...baseline, audience: a })}
          placeholder="Who is this for? (e.g. mobile developers, beginners...)"
          required
          multiline
          numberOfLines={2}
        />

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Language</Text>
          <View style={styles.selectorRow}>
            {["English", "Spanish"].map((lang) => {
              const isSelected = baseline.language === lang;
              return (
                <Pressable
                  key={lang}
                  style={[
                    styles.langOption,
                    isSelected && {
                      backgroundColor: themeColors.buttonPrimary,
                      borderColor: themeColors.buttonPrimary,
                    },
                  ]}
                  onPress={() => setBaseline({ ...baseline, language: lang })}
                >
                  <Text
                    style={[
                      styles.langOptionText,
                      isSelected && { color: "#fff", opacity: 1 },
                    ]}
                  >
                    {lang}
                  </Text>
                </Pressable>
              );
            })}
          </View>
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
  formContent: { padding: 25, paddingTop: 60, paddingBottom: 100 },
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
    letterSpacing: 1.2,
  },
  selectorRow: { flexDirection: "row", gap: 12, marginTop: 5 },
  langOption: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  langOptionText: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#fff",
    opacity: 0.7,
  },
  primaryButton: {
    height: 64,
    borderRadius: 18,
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
