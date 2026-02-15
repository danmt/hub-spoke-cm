// packages/mobile/app/(tabs)/hubs/new.tsx
import { FontAwesome } from "@expo/vector-icons";
import { ConfigService, RegistryService, SecretService } from "@hub-spoke/core";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
} from "react-native";

import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { useInteractionDeferrer } from "@/hooks/useInteractionDeferrer";
import { executeMobileCreateHubAction } from "@/presets/executeMobileCreateHubAction";
import { useWorkspace } from "@/services/WorkspaceContext";
import { WorkspaceManager } from "@/services/WorkspaceManager";

// Proposal Components
import { ArchitectProposal } from "@/components/proposals/ArchitectProposal";
import { AssemblerProposal } from "@/components/proposals/AssemblerProposal";
import { ConfirmRetry } from "@/components/proposals/ConfirmRetry";
import { PersonaProposal } from "@/components/proposals/PersonaProposal";

type ScreenState = "IDLE" | "PROCESSING" | "REVIEWING" | "ERROR" | "DONE";

export default function NewHubScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";
  const themeColors = Colors[colorScheme];
  const { activeWorkspace } = useWorkspace();

  const { pendingInteraction, ask, handleResolve } = useInteractionDeferrer();

  const [state, setState] = useState<ScreenState>("IDLE");
  const [statusMessage, setStatusMessage] = useState("");
  const [activeAgent, setActiveAgent] = useState<{
    id: string;
    model: string;
  } | null>(null);
  const [createdHubId, setCreatedHubId] = useState<string | null>(null);

  // Baseline Form State
  const [baseline, setBaseline] = useState({
    topic: "",
    goal: "",
    audience: "",
    language: "English",
  });

  const pulseAnim = useMemo(() => new Animated.Value(1), []);

  useEffect(() => {
    if (state === "PROCESSING") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.4,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [state]);

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
      const workspaceRoot = workspaceDir.uri;

      const artifacts = await RegistryService.getAllArtifacts(workspaceRoot);
      const agents = RegistryService.initializeAgents(
        secret.apiKey,
        config.model!,
        artifacts,
      );
      const manifest = RegistryService.toManifest(agents);

      const result = await executeMobileCreateHubAction(
        secret.apiKey,
        config.model!,
        manifest,
        baseline,
        agents,
        workspaceRoot,
        {
          ask: async (type, data) => {
            setState("REVIEWING");
            return await ask(type, data);
          },
          onStatus: (msg) => {
            setState("PROCESSING");
            setStatusMessage(msg);
            // Dynamic watermark update based on the phase
            setActiveAgent({
              id: msg.includes("Architect")
                ? "Architect"
                : msg.match(/\((.*?)\)/)?.[1] || "Core",
              model: config.model!,
            });
          },
        },
      );

      setCreatedHubId(result.assembly.blueprint.hubId);
      setState("DONE");
    } catch (err: any) {
      console.error(err);
      setStatusMessage(err.message);
      setState("ERROR");
    }
  };

  // 1. DONE: The Victory Screen
  if (state === "DONE") {
    return (
      <View style={styles.centered}>
        <Text style={styles.victoryEmoji}>🏗️</Text>
        <Text style={styles.title}>Hub Architected!</Text>
        <Text style={styles.description}>
          The structure for "{baseline.topic}" is ready. Would you like to
          generate the content now?
        </Text>

        <View style={styles.victoryActions}>
          <Pressable
            style={[
              styles.primaryButton,
              { backgroundColor: themeColors.buttonPrimary },
            ]}
            onPress={() =>
              router.replace({
                pathname: "/(tabs)/hubs/fill",
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
              View Scaffold Only
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.replace("/hubs")}
            style={{ marginTop: 20 }}
          >
            <Text style={{ opacity: 0.5, fontWeight: "600" }}>
              Back to Hubs List
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // 2. Processing View with Agent Watermark and Pulse
  if (state === "PROCESSING") {
    return (
      <View style={styles.centered}>
        {activeAgent && (
          <View style={styles.agentWatermark}>
            <FontAwesome name="shield" size={10} color={themeColors.tint} />
            <Text style={styles.agentWatermarkText}>
              {activeAgent.id.toUpperCase()} | {activeAgent.model}
            </Text>
          </View>
        )}
        <ActivityIndicator size="large" color={themeColors.tint} />
        <Animated.Text style={[styles.statusText, { opacity: pulseAnim }]}>
          {statusMessage}
        </Animated.Text>
      </View>
    );
  }

  // 3. Reviewing View (Modals/Proposals)
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

  // 4. Error View
  if (state === "ERROR") {
    return (
      <View style={styles.centered}>
        <FontAwesome name="exclamation-triangle" size={50} color="#ff4444" />
        <Text style={[styles.title, { color: "#ff4444", marginTop: 20 }]}>
          Architect Failed
        </Text>
        <Text style={styles.errorText}>{statusMessage}</Text>
        <Pressable
          style={[
            styles.primaryButton,
            {
              backgroundColor: themeColors.buttonPrimary,
              marginTop: 30,
              width: "100%",
            },
          ]}
          onPress={() => setState("IDLE")}
        >
          <Text style={styles.buttonText}>Edit Baseline & Retry</Text>
        </Pressable>
      </View>
    );
  }

  // 5. IDLE: The Baseline Form
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.formContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>New Hub</Text>
        <Text style={styles.description}>
          Provide the initial context. The Architect agent will help you refine
          this plan.
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
            placeholder="e.g. Clean Architecture in Swift"
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
            placeholder="What should the reader learn?"
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

        <View style={styles.spacer} />

        <Pressable
          style={[
            styles.primaryButton,
            { backgroundColor: themeColors.buttonPrimary },
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
  title: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
  },
  description: {
    fontSize: 16,
    opacity: 0.6,
    lineHeight: 24,
    marginBottom: 30,
    textAlign: "center",
  },
  inputGroup: { marginBottom: 25 },
  label: {
    fontSize: 12,
    fontWeight: "bold",
    opacity: 0.5,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  input: { height: 50, borderBottomWidth: 2, fontSize: 18, paddingVertical: 5 },
  statusText: {
    marginTop: 20,
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    opacity: 0.8,
  },
  errorText: {
    marginTop: 10,
    fontSize: 15,
    textAlign: "center",
    color: "#ff4444",
    opacity: 0.8,
  },
  spacer: { height: 20 },
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
    letterSpacing: 1,
  },
  victoryEmoji: { fontSize: 60, marginBottom: 20 },
  victoryActions: { width: "100%", marginTop: 20 },
});
