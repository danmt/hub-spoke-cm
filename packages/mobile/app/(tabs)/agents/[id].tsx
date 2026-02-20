import { AgentThinkingOverlay } from "@/components/AgentThinkingOverlay";
import { InputField } from "@/components/form/InputField";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import { Colors, ThemeColors } from "@/constants/Colors";
import { useAgents } from "@/services/AgentsContext";
import { useWorkspace } from "@/services/WorkspaceContext";
import { WorkspaceManager } from "@/services/WorkspaceManager";
import { Vibe } from "@/utils/vibe";
import { FontAwesome } from "@expo/vector-icons";
import {
  AgentInteractionEntry,
  AgentService,
  AssemblerArtifact,
  ConfigService,
  EvolutionResult,
  PersonaArtifact,
  SecretService,
  WriterArtifact,
} from "@hub-spoke/core";
import * as Crypto from "expo-crypto";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
} from "react-native";

export default function AgentDetailsScreen() {
  const { id, type } = useLocalSearchParams<{ id: string; type: any }>();
  const { getAgent, deleteAgent, evolveAgent, refresh } = useAgents();
  const { activeWorkspace, upsertAgentIndex } = useWorkspace();
  const themeColors = Colors[useColorScheme() ?? "dark"];
  const router = useRouter();

  const [isEvolving, setIsEvolving] = useState(false);
  const [evolutionResult, setEvolutionResult] =
    useState<EvolutionResult | null>(null);
  const [showForkModal, setShowForkModal] = useState(false);
  const [newForkName, setNewForkName] = useState("");
  const [isForking, setIsForking] = useState(false);

  // Buffer and Interaction State
  const [history, setHistory] = useState<AgentInteractionEntry[]>([]);
  const [showTeachModal, setShowTeachModal] = useState(false);
  const [manualInstruction, setManualInstruction] = useState("");

  // UX State: Collapsible toggles
  const [isTruthsExpanded, setIsTruthsExpanded] = useState(false);
  const [isBufferExpanded, setIsBufferExpanded] = useState(false);

  const agent = useMemo(() => getAgent(type, id), [id, type, getAgent]);

  const loadLearningData = async () => {
    const workspaceDir = WorkspaceManager.getWorkspaceUri(activeWorkspace);
    const data = await AgentService.getFeedback(workspaceDir.uri, type, id);
    setHistory(data);
  };

  useEffect(() => {
    loadLearningData();
  }, [id, type]);

  if (!agent) {
    return (
      <View style={styles.centered}>
        <Text>Agent not found.</Text>
      </View>
    );
  }

  const artifact = agent.artifact;

  const toggleTruths = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsTruthsExpanded(!isTruthsExpanded);
  };

  const toggleBuffer = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsBufferExpanded(!isBufferExpanded);
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete Agent",
      `Are you sure you want to delete ${artifact.id}? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              router.dismissAll();
              router.replace("/(tabs)/agents");
              await deleteAgent(type, id);
            } catch (err: any) {
              Alert.alert("Deletion Error", err.message);
            }
          },
        },
      ],
    );
  };

  const handleEvolve = async () => {
    setIsEvolving(true);
    try {
      const result = await evolveAgent(type, id);
      setEvolutionResult(result);

      if (result.conflictType === "hard") {
        setNewForkName(result.suggestedForkName || "");
        setShowForkModal(true);
      } else {
        await loadLearningData(); // Refresh history for soft updates
      }
      Vibe.handoff();
    } catch (err: any) {
      Alert.alert("Evolution Failed", err.message);
    } finally {
      setIsEvolving(false);
    }
  };

  const executeFork = async () => {
    if (!evolutionResult || !activeWorkspace) return;

    const secret = await SecretService.getSecret();
    const config = await ConfigService.getConfig();

    if (!secret.apiKey) {
      Alert.alert("Gemini API Key is missing");
      return;
    }

    if (!config.model) {
      Alert.alert("Model is missing");
      return;
    }

    setIsForking(true); // Lock the UI

    try {
      const workspaceDir = WorkspaceManager.getWorkspaceUri(activeWorkspace);
      const newId = Crypto.randomUUID();
      const newAgent = await AgentService.forkAgent(
        secret.apiKey,
        config.model,
        workspaceDir.uri,
        id,
        newId,
        type,
        newForkName,
        evolutionResult.analysis,
      );

      await AgentService.clearFeedbackBuffer(workspaceDir.uri, type, id);
      setShowForkModal(false);
      setEvolutionResult(null);

      await upsertAgentIndex({
        id: newId,
        type,
        displayName: newForkName,
        description: newAgent.description,
      });

      await refresh();
      await Vibe.handoff();

      Alert.alert("Success", `Specialized agent "${newForkName}" created.`, [
        { text: "View Registry", onPress: () => router.push("/(tabs)/agents") },
      ]);
    } catch (err: any) {
      Alert.alert("Fork Failed", err.message);
    } finally {
      setIsForking(false); // Release the lock
    }
  };

  const handleManualTeach = async () => {
    if (!manualInstruction.trim() || !activeWorkspace) return;

    try {
      const workspaceDir = WorkspaceManager.getWorkspaceUri(activeWorkspace);
      await AgentService.appendFeedback(
        workspaceDir.uri,
        artifact.type,
        artifact.id,
        {
          source: "manual",
          outcome: "feedback",
          text: manualInstruction,
        },
      );
      setManualInstruction("");
      setShowTeachModal(false);
      await loadLearningData();
      if (!isBufferExpanded) toggleBuffer();
    } catch (err: any) {
      Alert.alert("Teaching Error", err.message);
    }
  };

  const handleEdit = () => {
    router.push({
      pathname: "/agents/editor",
      params: { id: artifact.id, type: artifact.type },
    });
  };

  if (isEvolving) {
    return (
      <AgentThinkingOverlay
        agentId={artifact.id}
        model="Evolution Engine"
        phase="styling"
        status="Extracting Rooted Truths..."
        color={themeColors.buttonPrimary}
      />
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: artifact.displayName || artifact.id,
          headerRight: () => (
            <Pressable onPress={handleEdit} style={{ padding: 8 }}>
              <FontAwesome name="pencil" size={20} color={themeColors.tint} />
            </Pressable>
          ),
        }}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Polymorphic Header Info */}
        {artifact.type === "persona" && (
          <PersonaDisplay artifact={artifact} theme={themeColors} />
        )}
        {artifact.type === "writer" && (
          <WriterDisplay artifact={artifact} theme={themeColors} />
        )}
        {artifact.type === "assembler" && (
          <AssemblerDisplay artifact={artifact} theme={themeColors} />
        )}

        {/* System Instructions Section */}
        <Text style={styles.sectionTitle}>Behaviour</Text>
        <View
          style={[
            styles.contentCard,
            { backgroundColor: themeColors.cardBackground },
          ]}
        >
          <Text style={styles.contentBody}>{artifact.content}</Text>
        </View>

        {/* KNOWLEDGE SECTION (Truths) */}
        <Pressable style={styles.collapsibleHeader} onPress={toggleTruths}>
          <Text style={styles.sectionTitle}>
            Learned Truths ({artifact.truths.length})
          </Text>
          <FontAwesome
            name={isTruthsExpanded ? "chevron-up" : "chevron-down"}
            size={12}
            color="#888"
          />
        </Pressable>

        {isTruthsExpanded && (
          <View style={styles.knowledgeList}>
            {artifact.truths.length === 0 ? (
              <Text style={styles.emptyText}>No truths rooted yet.</Text>
            ) : (
              artifact.truths
                .sort((a, b) => b.weight - a.weight)
                .map((truth, i) => (
                  <View
                    key={i}
                    style={[
                      styles.truthCard,
                      { backgroundColor: themeColors.cardBackground },
                    ]}
                  >
                    <Text style={styles.truthText}>{truth.text}</Text>
                    <View style={styles.weightContainer}>
                      <View
                        style={[
                          styles.weightBar,
                          {
                            width: `${truth.weight * 100}%`,
                            backgroundColor: themeColors.buttonPrimary,
                          },
                        ]}
                      />
                    </View>
                  </View>
                ))
            )}
          </View>
        )}

        {/* FEEDBACK BUFFER SECTION */}
        <Pressable style={styles.collapsibleHeader} onPress={toggleBuffer}>
          <Text style={styles.sectionTitle}>
            Learning Buffer ({history.length})
          </Text>
          <FontAwesome
            name={isBufferExpanded ? "chevron-up" : "chevron-down"}
            size={12}
            color="#888"
          />
        </Pressable>

        {isBufferExpanded && (
          <View style={styles.historyList}>
            {history.length === 0 ? (
              <Text style={styles.emptyText}>
                No interactions recorded in the current buffer.
              </Text>
            ) : (
              history.map((entry, i) => (
                <View
                  key={i}
                  style={[
                    styles.feedbackItem,
                    {
                      borderLeftColor:
                        entry.outcome === "accepted" ? "#32a852" : "#ffcc00",
                    },
                  ]}
                >
                  <View style={styles.feedbackHeader}>
                    <FontAwesome
                      name={entry.source === "manual" ? "university" : "bolt"}
                      size={12}
                      color={
                        entry.outcome === "accepted" ? "#32a852" : "#ffcc00"
                      }
                    />
                    <Text style={styles.feedbackDate}>
                      {new Date(entry.timestamp).toLocaleDateString()}
                    </Text>
                    <Text style={styles.sourceTag}>
                      {entry.source.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.feedbackText}>
                    {entry.text || "Agent performance was approved."}
                  </Text>
                </View>
              ))
            )}
          </View>
        )}

        {/* NEW Unified Learning Actions Footer */}
        <View style={styles.learningActionsFooter}>
          <Pressable
            style={[
              styles.actionButtonSecondary,
              { borderColor: themeColors.tint, flex: 1 },
            ]}
            onPress={() => setShowTeachModal(true)}
          >
            <FontAwesome
              name="commenting-o"
              size={16}
              color={themeColors.text}
            />
            <Text style={styles.actionButtonText}>Teach</Text>
          </Pressable>

          <Pressable
            style={[
              styles.actionButtonPrimary,
              {
                flex: 1,
              },
              history.length > 0
                ? { backgroundColor: themeColors.buttonPrimary }
                : {
                    backgroundColor: "#999",
                    opacity: 0.7,
                  },
            ]}
            onPress={handleEvolve}
            disabled={history.length === 0}
          >
            <FontAwesome name="graduation-cap" size={16} color="#fff" />
            <Text style={[styles.actionButtonText, { color: "#fff" }]}>
              Train
            </Text>
          </Pressable>
        </View>

        <Pressable
          style={[styles.deleteButton, { borderColor: "#ff4444" }]}
          onPress={handleDelete}
        >
          <FontAwesome name="trash" size={16} color="#ff4444" />
          <Text style={styles.deleteButtonText}>Delete Agent</Text>
        </Pressable>
      </ScrollView>

      {/* Manual Teaching Modal */}
      <Modal visible={showTeachModal} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View
            style={[
              styles.modalContent,
              { backgroundColor: themeColors.modalBackground },
            ]}
          >
            <Text style={styles.modalTitle}>Manual Instruction</Text>
            <Text style={styles.modalSubtitle}>
              Directly update the agent's behavior buffer. Processed during
              evolution.
            </Text>

            <InputField
              label="Instruction"
              placeholder="e.g. Always use metric units in technical drafts."
              multiline
              value={manualInstruction}
              onChangeText={setManualInstruction}
              style={{ height: 120 }}
            />

            <View style={styles.modalActions}>
              <Pressable
                style={styles.cancelBtn}
                onPress={() => setShowTeachModal(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.saveBtn,
                  { backgroundColor: themeColors.buttonPrimary },
                ]}
                onPress={handleManualTeach}
                disabled={!manualInstruction.trim()}
              >
                <Text style={styles.saveBtnText}>Save to Buffer</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Evolution Summary Modal */}
      <Modal visible={!!evolutionResult} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: themeColors.modalBackground },
            ]}
          >
            <Text style={styles.modalTitle}>Evolution Complete</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              <Text style={styles.modalSubtitle}>
                {evolutionResult?.thoughtProcess}
              </Text>

              {evolutionResult?.addedTruths.map((t, i) => (
                <View key={i} style={styles.proposalItem}>
                  <Text style={{ color: "#32a852" }}>+ [NEW] {t}</Text>
                </View>
              ))}
              {evolutionResult?.strengthenedTruths.map((t, i) => (
                <View key={i} style={styles.proposalItem}>
                  <Text style={{ color: themeColors.tint }}>
                    ↑ [REINFORCED] {t}
                  </Text>
                </View>
              ))}
              {evolutionResult?.weakenedTruths.map((t, i) => (
                <View key={i} style={styles.proposalItem}>
                  <Text style={{ color: "#ffcc00" }}>↓ [WEAKENED] {t}</Text>
                </View>
              ))}
            </ScrollView>
            <Pressable
              style={[
                styles.saveBtn,
                { backgroundColor: themeColors.buttonPrimary, marginTop: 20 },
              ]}
              onPress={() => setEvolutionResult(null)}
            >
              <Text style={styles.saveBtnText}>Awesome</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={showForkModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: themeColors.modalBackground },
            ]}
          >
            <Text style={styles.modalTitle}>🔱 Contradiction Detected</Text>

            <View style={styles.conflictCard}>
              {evolutionResult?.violatedMetadataField ? (
                <Text style={styles.conflictText}>
                  Feedback violates current{" "}
                  {evolutionResult.violatedMetadataField.toUpperCase()}.{"\n"}
                  New value will be:{" "}
                  <Text
                    style={{
                      color: themeColors.buttonPrimary,
                      fontWeight: "bold",
                    }}
                  >
                    {evolutionResult.newMetadataValue}
                  </Text>
                </Text>
              ) : (
                <Text style={styles.conflictText}>
                  Feedback contradicts rooted truth:{"\n"}
                  <Text style={{ fontStyle: "italic", opacity: 0.8 }}>
                    "{evolutionResult?.violatedTruth}"
                  </Text>
                </Text>
              )}
            </View>

            <Text style={styles.modalSubtitle}>
              A specialized fork is recommended to preserve the original agent's
              identity.
            </Text>

            <InputField
              label="New Agent Name"
              value={newForkName}
              onChangeText={setNewForkName}
              placeholder="e.g. Playful Juan"
            />

            <View style={styles.modalActions}>
              <Pressable
                style={styles.cancelBtn}
                onPress={() => setShowForkModal(false)}
              >
                <Text style={styles.cancelBtnText}>Discard</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.saveBtn,
                  {
                    backgroundColor: isForking
                      ? "#666"
                      : themeColors.buttonPrimary,
                  },
                ]}
                onPress={executeFork}
                disabled={isForking}
              >
                {isForking ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>Fork Agent</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function PersonaDisplay({
  artifact,
  theme,
}: {
  artifact: PersonaArtifact;
  theme: ThemeColors;
}) {
  return (
    <>
      <View
        style={[styles.headerCard, { backgroundColor: theme.cardBackground }]}
      >
        <Text style={styles.typeLabel}>Persona</Text>
        <Text style={styles.title}>{artifact.displayName || artifact.id}</Text>
        <Text style={styles.idSubtext}>ID: {artifact.id}</Text>
        <Text style={styles.description}>{artifact.description}</Text>
      </View>
      <View style={styles.metaSection}>
        <Text style={styles.sectionTitle}>Voice Profile</Text>
        <View style={styles.row}>
          <InfoTile
            icon="volume-up"
            label="Tone"
            value={artifact.metadata.tone}
            theme={theme}
          />
          <InfoTile
            icon="language"
            label="Lang"
            value={artifact.metadata.language}
            theme={theme}
          />
          <InfoTile
            icon="commenting-o"
            label="Accent"
            value={artifact.metadata.accent}
            theme={theme}
          />
        </View>
      </View>
    </>
  );
}

function WriterDisplay({
  artifact,
  theme,
}: {
  artifact: WriterArtifact;
  theme: ThemeColors;
}) {
  return (
    <>
      <View
        style={[styles.headerCard, { backgroundColor: theme.cardBackground }]}
      >
        <Text style={styles.typeLabel}>Writer</Text>
        <Text style={styles.title}>{artifact.displayName || artifact.id}</Text>
        <Text style={styles.idSubtext}>ID: {artifact.id}</Text>
        <Text style={styles.description}>{artifact.description}</Text>
      </View>
      <View style={styles.metaSection}>
        <Text style={styles.sectionTitle}>Drafting Strategy</Text>
        <View style={[styles.strategyCard, { borderColor: theme.tint + "40" }]}>
          <FontAwesome name="terminal" size={14} color={theme.tint} />
          <Text style={styles.strategyText}>
            This agent handles neutral technical drafting without bias.
          </Text>
        </View>
      </View>
    </>
  );
}

function AssemblerDisplay({
  artifact,
  theme,
}: {
  artifact: AssemblerArtifact;
  theme: ThemeColors;
}) {
  return (
    <View
      style={[styles.headerCard, { backgroundColor: theme.cardBackground }]}
    >
      <Text style={styles.typeLabel}>Assembler</Text>
      <Text style={styles.title}>{artifact.displayName || artifact.id}</Text>
      <Text style={styles.idSubtext}>ID: {artifact.id}</Text>
      <Text style={styles.description}>{artifact.description}</Text>
    </View>
  );
}

function InfoTile({
  icon,
  label,
  value,
  theme,
}: {
  icon: any;
  label: string;
  value: string;
  theme: ThemeColors;
}) {
  return (
    <View style={[styles.tile, { backgroundColor: theme.cardBackground }]}>
      <FontAwesome
        name={icon}
        size={16}
        color={theme.tint}
        style={{ marginBottom: 6 }}
      />
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  scrollContent: { padding: 20, paddingBottom: 60 },
  headerCard: { padding: 25, borderRadius: 24, marginBottom: 25 },
  typeLabel: {
    fontSize: 10,
    fontWeight: "900",
    opacity: 0.4,
    marginBottom: 8,
    letterSpacing: 1,
  },
  title: { fontSize: 28, fontWeight: "bold", marginBottom: 4 },
  idSubtext: {
    fontSize: 12,
    opacity: 0.4,
    fontWeight: "bold",
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  description: { fontSize: 16, lineHeight: 22, opacity: 0.8 },
  metaSection: { marginBottom: 25 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "900",
    textTransform: "uppercase",
    opacity: 0.4,
    marginBottom: 15,
    letterSpacing: 1,
  },
  collapsibleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    marginBottom: 15,
  },
  row: { flexDirection: "row", gap: 10 },
  tile: { flex: 1, padding: 15, borderRadius: 16, alignItems: "flex-start" },
  tileLabel: {
    fontSize: 10,
    fontWeight: "bold",
    opacity: 0.4,
    textTransform: "uppercase",
  },
  tileValue: { fontSize: 14, fontWeight: "bold", marginTop: 4 },
  strategyCard: {
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  strategyText: { fontSize: 13, opacity: 0.7, flex: 1 },
  contentCard: { padding: 20, borderRadius: 20, marginBottom: 30 },
  contentBody: {
    fontSize: 14,
    lineHeight: 22,
    fontStyle: "italic",
    opacity: 0.7,
  },
  learningActionsFooter: {
    flexDirection: "row",
    gap: 12,
    marginTop: 10,
    paddingTop: 20,
    marginBottom: 20,
    borderTopWidth: 1,
    borderTopColor: "rgba(128,128,128,0.1)",
  },
  actionButtonPrimary: {
    flex: 2,
    height: 50,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  actionButtonSecondary: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  actionButtonText: {
    fontWeight: "bold",
    fontSize: 14,
  },
  knowledgeList: { marginBottom: 20 },
  truthCard: { padding: 15, borderRadius: 12, marginBottom: 10 },
  truthText: {
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
    marginBottom: 10,
  },
  weightContainer: {
    height: 4,
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 2,
    overflow: "hidden",
  },
  weightBar: { height: "100%" },
  historyList: { marginBottom: 20 },
  feedbackItem: {
    padding: 15,
    borderLeftWidth: 3,
    marginBottom: 12,
    backgroundColor: "rgba(128,128,128,0.05)",
    borderRadius: 8,
  },
  feedbackHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  feedbackDate: { fontSize: 11, opacity: 0.4, fontWeight: "bold" },
  sourceTag: {
    fontSize: 9,
    fontWeight: "900",
    opacity: 0.3,
    marginLeft: "auto",
  },
  feedbackText: { fontSize: 14, lineHeight: 20, opacity: 0.7 },
  emptyText: {
    fontSize: 13,
    opacity: 0.4,
    fontStyle: "italic",
    paddingHorizontal: 5,
    marginBottom: 20,
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 10,
    gap: 10,
  },
  deleteButtonText: { color: "#ff4444", fontWeight: "bold" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  modalContent: {
    padding: 30,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    minHeight: 400,
  },
  modalTitle: { fontSize: 22, fontWeight: "bold", marginBottom: 10 },
  modalSubtitle: {
    fontSize: 14,
    opacity: 0.6,
    lineHeight: 20,
    marginBottom: 25,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 20,
    marginTop: 10,
  },
  cancelBtn: { padding: 10 },
  cancelBtnText: { color: "#888", fontWeight: "bold" },
  saveBtn: { paddingHorizontal: 25, paddingVertical: 15, borderRadius: 12 },
  saveBtnText: { color: "#fff", fontWeight: "bold" },
  proposalItem: {
    padding: 10,
    backgroundColor: "rgba(128,128,128,0.1)",
    borderRadius: 8,
    marginBottom: 6,
  },
  conflictCard: {
    padding: 20,
    borderRadius: 16,
    backgroundColor: "rgba(255, 68, 68, 0.1)", // Light red background for attention
    borderLeftWidth: 4,
    borderLeftColor: "#ff4444", // Strong red accent for the contradiction
    marginBottom: 20,
    width: "100%",
  },
  conflictText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "500",
    color: "#fff", // Adjust based on theme if necessary
  },
});
