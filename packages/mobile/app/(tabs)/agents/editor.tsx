// packages/mobile/app/agents/editor.tsx
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import { Colors } from "@/constants/Colors";
import { useAgents } from "@/services/AgentsContext";
import { AgentsStorage } from "@/services/AgentsStorage";
import { useWorkspace } from "@/services/WorkspaceContext";
import { WorkspaceManager } from "@/services/WorkspaceManager";
import { Vibe } from "@/utils/vibe";
import { FontAwesome } from "@expo/vector-icons";
import {
  ArtifactType,
  AssemblerArtifact,
  PersonaArtifact,
  WriterArtifact,
} from "@hub-spoke/core";
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
  TextInput,
  TextInputProps,
} from "react-native";

type EditorState = "SELECTING_TYPE" | "EDITING" | "SAVING" | "DONE";

type AgentFormState =
  | Partial<PersonaArtifact>
  | Partial<WriterArtifact>
  | Partial<AssemblerArtifact>;

interface InputFieldProps extends TextInputProps {
  label: string;
  disabled?: boolean;
}

function InputField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  disabled,
  style,
  ...rest
}: InputFieldProps) {
  const themeColors = Colors[useColorScheme() ?? "dark"];

  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...rest}
        style={[
          styles.input,
          {
            color: themeColors.text,
            borderColor: "rgba(255,255,255,0.4)",
            backgroundColor: "rgba(255,255,255,0.08)",
          },
          multiline && { height: 80, textAlignVertical: "top" },
          disabled && { opacity: 0.5 },
          style,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#aaa"
        multiline={multiline}
        editable={!disabled}
      />
    </View>
  );
}

export default function AgentEditorScreen() {
  const router = useRouter();
  const { id, type: initialType } = useLocalSearchParams<{
    id: string;
    type: ArtifactType;
  }>();
  const { activeWorkspace, upsertAgentIndex, manifest } = useWorkspace();
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
  const [formData, setFormData] = useState<AgentFormState>({
    id: id || "",
    description: "",
    content: "",
    language: "English",
  });
  const { refresh } = useAgents();

  useEffect(() => {
    if (isEditMode && id) {
      const existing = getAgent(agentType, id);
      if (existing) {
        setFormData({ ...existing.artifact });
      }
    }
  }, [id, isEditMode, agentType, getAgent]);

  const handleSave = async () => {
    if (!formData.id || !formData.description || !formData.content) {
      Alert.alert(
        "Required",
        "ID, Description, and Instructions are required.",
      );
      return;
    }

    if (!activeWorkspace) return;

    setState("SAVING");
    try {
      const workspaceDir = WorkspaceManager.getWorkspaceUri(activeWorkspace);
      const targetId = formData.id;

      const frontmatter: Record<string, any> = {
        id: targetId,
        type: agentType,
        description: formData.description,
      };

      if (agentType === "persona") {
        const p = formData as Partial<PersonaArtifact>;
        frontmatter.name = p.name || p.id;
        frontmatter.tone = p.tone || "Neutral";
        frontmatter.accent = p.accent || "Standard";
        frontmatter.language = p.language || "English";
      } else if (agentType === "assembler") {
        const a = formData as Partial<AssemblerArtifact>;
        frontmatter.writerIds = a.writerIds || [];
      }

      await AgentsStorage.saveAgentToFile({
        workspaceUri: workspaceDir.uri,
        type: agentType,
        id: targetId,
        frontmatter,
        content: formData.content,
      });

      await upsertAgentIndex({
        id: targetId,
        type: agentType,
        name:
          agentType === "persona"
            ? (formData as PersonaArtifact).name
            : undefined,
        description: formData.description,
      });
      await refresh();
      await Vibe.handoff();

      if (isEditMode) {
        Alert.alert("Success", `Agent @${targetId} updated.`, [
          { text: "OK", onPress: () => router.back() },
        ]);
      } else {
        setSavedAgentId(targetId);
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
          ({ ...prev, language: "English" }) as Partial<PersonaArtifact>,
      );
    }
    setState("EDITING");
  };

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

  if (state === "DONE" && savedAgentId) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ headerRight: undefined }} />
        <Text style={styles.victoryEmoji}>🚀</Text>
        <Text style={styles.title}>Agent Deployed</Text>
        <Text style={styles.doneSub}>
          Agent @{savedAgentId} is ready for action.
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
          label="Agent ID (Slug)"
          value={formData.id}
          onChangeText={(v) =>
            setFormData({
              ...formData,
              id: v.toLowerCase().replace(/\s/g, "-"),
            })
          }
          placeholder="e.g. technical-prose"
          disabled={isEditMode}
        />

        <InputField
          label="Role Description (For AI)"
          value={formData.description}
          onChangeText={(v) => setFormData({ ...formData, description: v })}
          placeholder="Describe the agent's specific purpose..."
          multiline
        />

        {agentType === "persona" && (
          <>
            <InputField
              label="Display Name"
              value={(formData as PersonaArtifact).name}
              onChangeText={(v) =>
                setFormData({ ...formData, name: v } as PersonaArtifact)
              }
              placeholder="e.g. Lead Storyteller"
            />
            <InputField
              label="Tone"
              value={(formData as PersonaArtifact).tone}
              onChangeText={(v) =>
                setFormData({ ...formData, tone: v } as PersonaArtifact)
              }
              placeholder="e.g. Sarcastic, Concise"
            />

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Output Language</Text>
              <View style={styles.selectorRow}>
                {["English", "Spanish"].map((lang) => {
                  const isSelected =
                    (formData as PersonaArtifact).language === lang;
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
                          language: lang,
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
          </>
        )}

        {agentType === "assembler" && manifest?.agents && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Allowed Writers</Text>
            <View style={styles.tagCloud}>
              {manifest.agents
                .filter((a) => a.type === "writer")
                .map((w) => {
                  const currentIds =
                    (formData as AssemblerArtifact).writerIds || [];
                  const selected = currentIds.includes(w.id);
                  return (
                    <Pressable
                      key={w.id}
                      style={[
                        styles.tag,
                        selected && {
                          backgroundColor: themeColors.buttonPrimary,
                          borderColor: themeColors.buttonPrimary,
                        },
                      ]}
                      onPress={() => {
                        const next = selected
                          ? currentIds.filter((i) => i !== w.id)
                          : [...currentIds, w.id];
                        setFormData({
                          ...formData,
                          writerIds: next,
                        } as AssemblerArtifact);
                      }}
                    >
                      <Text
                        style={[
                          styles.tagText,
                          selected && { color: "#ffffff", opacity: 1 },
                        ]}
                      >
                        {w.id}
                      </Text>
                    </Pressable>
                  );
                })}
            </View>
          </View>
        )}

        <InputField
          label="System Instructions"
          value={formData.content}
          onChangeText={(v) => setFormData({ ...formData, content: v })}
          placeholder="Detailed behavior strategy..."
          multiline
          style={{ height: 250 }}
        />
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
      <View style={{ flex: 1, backgroundColor: "transparent" }}>
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
  input: {
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
    borderRadius: 12,
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
});
