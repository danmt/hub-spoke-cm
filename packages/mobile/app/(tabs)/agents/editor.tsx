// packages/mobile/app/(tabs)/agents/editor.tsx
import { InputField } from "@/components/form/InputField";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import { Colors } from "@/constants/Colors";
import { useAgents } from "@/services/AgentsContext";
import { useWorkspace } from "@/services/WorkspaceContext";
import { WorkspaceManager } from "@/services/WorkspaceManager";
import { Vibe } from "@/utils/vibe";
import { FontAwesome } from "@expo/vector-icons";
import {
  AgentService,
  AgentTruth,
  Artifact,
  ArtifactType,
  AssemblerArtifact,
  ConfigService,
  IntelligenceService,
  PersonaArtifact,
  SecretService,
  WriterArtifact,
} from "@hub-spoke/core";
import * as Crypto from "expo-crypto";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
} from "react-native";

type EditorState = "SELECTING_TYPE" | "EDITING" | "SAVING" | "DONE" | "ERROR";

type AgentFormState =
  | Partial<PersonaArtifact>
  | Partial<WriterArtifact>
  | Partial<AssemblerArtifact>;

export default function AgentEditorScreen() {
  const router = useRouter();
  const { id, type: initialType } = useLocalSearchParams<{
    id: string;
    type: ArtifactType;
  }>();
  const { activeWorkspace, upsertAgentIndex } = useWorkspace();
  const { getAgent } = useAgents();
  const themeColors = Colors[useColorScheme() ?? "dark"];
  const isEditMode = !!id;
  const [state, setState] = useState<EditorState>(
    isEditMode ? "EDITING" : "SELECTING_TYPE",
  );
  const [agentType, setAgentType] = useState<ArtifactType>(
    initialType || "persona",
  );
  const [savedAgentId, setSavedAgentId] = useState<string | null>(null);
  const [savedAgentDisplayName, setSavedAgentDisplayName] = useState<
    string | null
  >(null);
  const [formData, setFormData] = useState<AgentFormState>({
    id: id || "",
    description: "",
    content: "",
    metadata: {
      language: "",
      accent: "",
      tone: "",
    },
  });
  const { refresh } = useAgents();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [prerequisites, setPrerequisites] = useState<{
    model: string;
    apiKey: string;
  } | null>(null);

  useEffect(() => {
    async function checkPrerequisites() {
      const secret = await SecretService.getSecret();
      const config = await ConfigService.getConfig();

      // 1. Check for API Key
      if (!secret.apiKey) {
        setStatusMessage(
          "Missing Gemini API Key. Please set it in Settings > Secrets.",
        );
        setState("ERROR");
        return;
      }

      // 2. Check for Default Model
      if (!config.model) {
        setStatusMessage(
          "Default AI Model not set. Please configure it in Settings.",
        );
        setState("ERROR");
        return;
      }

      setPrerequisites({
        apiKey: secret.apiKey,
        model: config.model,
      });
    }

    checkPrerequisites();
  }, [activeWorkspace]);

  useEffect(() => {
    if (isEditMode && id) {
      const existing = getAgent(agentType, id);
      if (existing) {
        setFormData({ ...existing.artifact });
      }
    }
  }, [id, isEditMode, agentType, getAgent]);

  const validateForm = (): boolean => {
    if (!formData.displayName?.trim()) {
      Alert.alert("Validation Error", "Persona needs a display name.");
      return false;
    }

    if (agentType === "persona") {
      const p = formData as Partial<PersonaArtifact>;

      if (!p.metadata?.tone?.trim()) {
        Alert.alert(
          "Validation Error",
          "Please define the tone for this persona.",
        );
        return false;
      }

      if (!p.metadata?.accent?.trim()) {
        Alert.alert(
          "Validation Error",
          "Please define the accent for this persona.",
        );
        return false;
      }
    }

    if (!formData.content?.trim()) {
      Alert.alert(
        "Validation Error",
        "Behavior (the strategy) cannot be empty.",
      );
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    if (!activeWorkspace) return;
    if (!prerequisites) return;

    setState("SAVING");
    try {
      const workspaceDir = WorkspaceManager.getWorkspaceUri(activeWorkspace);

      let existingTruths: AgentTruth[] = [];
      let targetId = id;

      if (isEditMode && id) {
        const existing = getAgent(agentType, id);
        existingTruths = (existing?.artifact as Artifact)?.truths || [];
      } else {
        targetId = Crypto.randomUUID();
      }

      const description = await IntelligenceService.generateInferredDescription(
        prerequisites.apiKey,
        prerequisites.model,
        formData.displayName!,
        formData.content!,
        existingTruths,
      );

      await AgentService.saveAgent(workspaceDir.uri, {
        identity: {
          id: targetId,
          type: agentType,
          displayName: formData.displayName!,
          metadata:
            agentType === "persona"
              ? {
                  tone: (formData as Partial<PersonaArtifact>).metadata?.tone,
                  language: (formData as Partial<PersonaArtifact>).metadata
                    ?.language,
                  accent: (formData as Partial<PersonaArtifact>).metadata
                    ?.accent,
                }
              : {},
        },
        behavior: formData.content!,
        knowledge: {
          description,
          truths: existingTruths,
        },
      });

      await upsertAgentIndex({
        id: targetId,
        type: agentType,
        displayName: formData.displayName,
        description,
      });

      await refresh();
      await Vibe.handoff();

      if (isEditMode) {
        Alert.alert("Success", `Agent ${formData.displayName} updated.`, [
          { text: "OK", onPress: () => router.back() },
        ]);
      } else {
        setSavedAgentId(targetId);
        setSavedAgentDisplayName(formData.displayName!);
        setState("DONE");
      }
    } catch (err: any) {
      Alert.alert("Save Error", err.message);
      setState("EDITING");
    }
  };

  const selectType = (type: ArtifactType) => {
    setAgentType(type);
    if (type === "persona") {
      setFormData(
        (prev) =>
          ({
            ...prev,
            metadata: { language: "English" },
          }) as Partial<PersonaArtifact>,
      );
    }
    setState("EDITING");
  };

  if (state === "ERROR") {
    return (
      <View style={styles.centered}>
        <FontAwesome name="exclamation-triangle" size={60} color="#ff4444" />
        <Text style={styles.title}>Action Blocked</Text>
        <Text style={styles.description}>{statusMessage}</Text>

        <View style={styles.victoryActions}>
          <Pressable
            style={[
              styles.primaryButton,
              { backgroundColor: themeColors.buttonPrimary },
            ]}
            onPress={() => router.push("/settings")}
          >
            <Text style={styles.buttonText}>Configure AI Settings</Text>
          </Pressable>

          <Pressable
            style={[styles.secondaryButton, { borderColor: themeColors.tint }]}
            onPress={() => router.back()}
          >
            <Text style={{ color: themeColors.tint, fontWeight: "bold" }}>
              Cancel
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (state === "SELECTING_TYPE") {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{ title: "Select Agent Type", headerRight: undefined }}
        />
        <View style={styles.selectorContainer}>
          <Text style={styles.selectorTitle}>What are we building?</Text>
          <TypeCard
            title="Persona"
            desc="Defines voice, tone, and personality."
            icon="user-circle"
            onPress={() => selectType("persona")}
            theme={themeColors}
          />
          <TypeCard
            title="Writer"
            desc="Handles technical drafting strategies."
            icon="pencil"
            onPress={() => selectType("writer")}
            theme={themeColors}
          />
          <TypeCard
            title="Assembler"
            desc="Architects the structural blueprint."
            icon="tasks"
            onPress={() => selectType("assembler")}
            theme={themeColors}
          />
          <Pressable style={styles.cancelBtn} onPress={() => router.back()}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (state === "DONE" && savedAgentId && savedAgentDisplayName) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ headerRight: undefined }} />
        <Text style={styles.victoryEmoji}>🚀</Text>
        <Text style={styles.title}>Agent Deployed</Text>
        <Text style={styles.doneSub}>
          Agent {savedAgentDisplayName} is ready for action.
        </Text>
        <Pressable
          style={[
            styles.primaryButton,
            { backgroundColor: themeColors.buttonPrimary, marginTop: 40 },
          ]}
          onPress={() =>
            router.replace({
              pathname: "/(tabs)/agents/[id]",
              params: { id: savedAgentId, type: agentType },
            })
          }
        >
          <Text style={styles.btnText}>Open Agent Details</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <Stack.Screen
        options={{
          title: isEditMode ? `Edit ${id}` : `New ${agentType}`,
          headerRight: () =>
            state === "SAVING" ? (
              <ActivityIndicator size="small" color={themeColors.tint} />
            ) : (
              <Pressable onPress={handleSave}>
                <Text
                  style={{
                    color: themeColors.tint,
                    fontWeight: "bold",
                    fontSize: 16,
                  }}
                >
                  Save
                </Text>
              </Pressable>
            ),
        }}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        <InputField
          label="Display Name"
          value={formData.displayName}
          onChangeText={(v) => setFormData({ ...formData, displayName: v })}
          placeholder="e.g. Lead Storyteller"
          required
        />

        <Text style={styles.helperText}>Give a name to your agent.</Text>

        {agentType === "persona" && (
          <>
            <InputField
              label="Tone"
              value={(formData as PersonaArtifact).metadata.tone}
              onChangeText={(v) =>
                setFormData({
                  ...formData,
                  metadata: { ...formData.metadata, tone: v },
                } as PersonaArtifact)
              }
              placeholder="e.g. Sarcastic, Concise"
              required
            />

            <Text style={styles.helperText}>
              Describe the tone of your agent.
            </Text>

            <InputField
              label="Accent"
              value={(formData as PersonaArtifact).metadata.accent}
              onChangeText={(v) =>
                setFormData({
                  ...formData,
                  metadata: { ...formData.metadata, accent: v },
                } as PersonaArtifact)
              }
              placeholder="e.g. London British"
              required
            />

            <Text style={styles.helperText}>
              Describe the accent of your agent.
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Output Language</Text>
              <View style={styles.selectorRow}>
                {["English", "Spanish"].map((lang) => {
                  const isSelected =
                    (formData as PersonaArtifact).metadata.language === lang;
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
                      onPress={() =>
                        setFormData({
                          ...formData,
                          metadata: {
                            ...formData.metadata,
                            language: lang,
                          },
                        } as PersonaArtifact)
                      }
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

            <Text style={styles.helperText}>
              Choose the langue your agent will use.
            </Text>
          </>
        )}

        <InputField
          label="Behavior"
          value={formData.content}
          onChangeText={(v) => setFormData({ ...formData, content: v })}
          placeholder="Write long essays about science..."
          multiline
          style={{ height: 250 }}
          required
        />

        <Text style={styles.helperText}>
          Describe the behavior of the agent.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function TypeCard({ title, desc, icon, onPress, theme }: any) {
  return (
    <Pressable
      style={[styles.typeCard, { backgroundColor: theme.cardBackground }]}
      onPress={onPress}
    >
      <View
        style={[
          styles.iconCircle,
          { backgroundColor: theme.buttonPrimary + "30" },
        ]}
      >
        <FontAwesome name={icon} size={22} color={theme.buttonPrimary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.typeTitle}>{title}</Text>
        <Text style={styles.typeDesc}>{desc}</Text>
      </View>
      <FontAwesome name="chevron-right" size={12} color="#aaa" />
    </Pressable>
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
  scroll: { padding: 25, paddingBottom: 60 },
  selectorContainer: { flex: 1, padding: 25, justifyContent: "center" },
  selectorTitle: {
    fontSize: 26,
    fontWeight: "bold",
    marginBottom: 35,
    textAlign: "center",
  },
  typeCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 22,
    borderRadius: 22,
    marginBottom: 18,
    gap: 18,
  },
  iconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
  },
  typeTitle: { fontSize: 20, fontWeight: "bold" },
  typeDesc: { fontSize: 14, opacity: 0.7, marginTop: 4 },
  cancelBtn: { marginTop: 25, alignSelf: "center" },
  cancelText: { color: "#bbb", fontWeight: "bold", fontSize: 15 },
  victoryEmoji: { fontSize: 80, marginBottom: 20 },
  title: { fontSize: 32, fontWeight: "bold", textAlign: "center" },
  doneSub: {
    fontSize: 16,
    opacity: 0.8,
    textAlign: "center",
    marginTop: 12,
    lineHeight: 24,
  },
  inputGroup: { marginBottom: 28 },
  label: {
    fontSize: 12,
    fontWeight: "900",
    opacity: 0.7,
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  helperText: {
    marginTop: -16,
    marginBottom: 28,
    paddingHorizontal: 4,
    fontSize: 13,
    opacity: 0.7,
    fontStyle: "italic",
  },
  primaryButton: {
    height: 60,
    borderRadius: 18,
    paddingHorizontal: 40,
    justifyContent: "center",
  },
  btnText: { color: "#fff", fontWeight: "bold", fontSize: 18 },
  tagCloud: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 6 },
  tag: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  tagText: { fontSize: 14, fontWeight: "bold", opacity: 0.8 },
  selectorRow: { flexDirection: "row", gap: 12 },
  langOption: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  langOptionText: { fontSize: 15, fontWeight: "bold", opacity: 0.7 },
  description: {
    fontSize: 16,
    opacity: 0.6,
    lineHeight: 24,
    marginTop: 12,
    textAlign: "center",
  },
  victoryActions: {
    width: "100%",
    marginTop: 40,
    gap: 12,
  },
  secondaryButton: {
    height: 60,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 18,
  },
});
