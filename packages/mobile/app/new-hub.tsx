import { ConfigService, RegistryService, SecretService } from "@hub-spoke/core";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

  // Baseline Form State
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
      const workspaceRoot = workspaceDir.uri;

      const artifacts = await RegistryService.getAllArtifacts(workspaceRoot);

      console.log(artifacts);
      console.log("ALKOOOOOOOOOOOOOOOO");

      const agents = RegistryService.initializeAgents(
        secret.apiKey,
        config.model!,
        artifacts,
      );
      const manifest = RegistryService.toManifest(agents);

      console.log(`manifest: ${manifest}`);

      await executeMobileCreateHubAction(
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
          },
        },
      );

      setState("DONE");
      router.replace("/");
    } catch (err: any) {
      console.error(err);
      setStatusMessage(err.message);
      setState("ERROR");
    }
  };

  // 1. Processing View
  if (state === "PROCESSING") {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={themeColors.tint} />
        <Text style={styles.statusText}>{statusMessage}</Text>
      </View>
    );
  }

  // 2. Reviewing View
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

  // 3. Error View
  if (state === "ERROR") {
    return (
      <View style={styles.centered}>
        <Text style={[styles.title, { color: "#ff4444" }]}>
          Generation Failed
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

  // 4. IDLE: The Baseline Form
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
  title: { fontSize: 34, fontWeight: "bold", marginBottom: 10 },
  description: { fontSize: 16, opacity: 0.6, lineHeight: 24, marginBottom: 30 },
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
  },
  buttonText: { color: "#fff", fontWeight: "bold", fontSize: 18 },
});
