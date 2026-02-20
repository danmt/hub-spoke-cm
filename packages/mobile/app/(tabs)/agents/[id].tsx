import { InputField } from "@/components/form/InputField";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import { Colors, ThemeColors } from "@/constants/Colors";
import { useAgents } from "@/services/AgentsContext";
import { AgentsStorage } from "@/services/AgentsStorage";
import { useWorkspace } from "@/services/WorkspaceContext";
import { WorkspaceManager } from "@/services/WorkspaceManager";
import { FontAwesome } from "@expo/vector-icons";
import {
  AgentInteractionEntry,
  AssemblerArtifact,
  IoService,
  PersonaArtifact,
  WriterArtifact,
} from "@hub-spoke/core";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
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
  const { getAgent, deleteAgent } = useAgents();
  const { activeWorkspace } = useWorkspace();
  const themeColors = Colors[useColorScheme() ?? "dark"];
  const router = useRouter();

  // Phase 2 State
  const [history, setHistory] = useState<AgentInteractionEntry[]>([]);
  const [showTeachModal, setShowTeachModal] = useState(false);
  const [manualInstruction, setManualInstruction] = useState("");

  // UX State: Collapsible toggles
  const [isTruthsExpanded, setIsTruthsExpanded] = useState(false);
  const [isBufferExpanded, setIsBufferExpanded] = useState(false);

  const agent = useMemo(() => getAgent(type, id), [id, type, getAgent]);

  const loadLearningData = async () => {
    const workspaceDir = WorkspaceManager.getWorkspaceUri(activeWorkspace);
    const data = await AgentsStorage.getAgentFeedback(
      workspaceDir.uri,
      type,
      id,
    );
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

  const handleManualTeach = async () => {
    if (!manualInstruction.trim() || !activeWorkspace) return;

    try {
      const workspaceDir = WorkspaceManager.getWorkspaceUri(activeWorkspace);
      await IoService.appendAgentInteraction(
        workspaceDir.uri,
        artifact.type,
        artifact.id,
        "manual",
        "feedback",
        manualInstruction,
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
        {/* Polymorphic Body */}
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
        <Text style={styles.sectionTitle}>System Instruction (Behavior)</Text>
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
        <View style={styles.sectionHeaderRow}>
          <Pressable
            style={[styles.collapsibleHeader, { flex: 1, marginTop: 0 }]}
            onPress={toggleBuffer}
          >
            <Text style={styles.sectionTitle}>
              Learning Buffer ({history.length})
            </Text>
            <FontAwesome
              name={isBufferExpanded ? "chevron-up" : "chevron-down"}
              size={12}
              color="#888"
            />
          </Pressable>
          <Pressable
            style={styles.teachButton}
            onPress={() => setShowTeachModal(true)}
          >
            <FontAwesome
              name="plus"
              size={10}
              color={themeColors.buttonPrimary}
            />
            <Text
              style={[
                styles.teachButtonText,
                { color: themeColors.buttonPrimary },
              ]}
            >
              Teach
            </Text>
          </Pressable>
        </View>

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
              Directly update the agent's behavior buffer. processed during
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
            value={artifact.tone}
            theme={theme}
          />
          <InfoTile
            icon="language"
            label="Lang"
            value={artifact.language}
            theme={theme}
          />
          <InfoTile
            icon="commenting-o"
            label="Accent"
            value={artifact.accent}
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
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
  },
  teachButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 8,
    borderRadius: 8,
    backgroundColor: "rgba(50, 168, 82, 0.1)",
    marginBottom: 15,
  },
  teachButtonText: { fontSize: 12, fontWeight: "bold" },
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
    marginTop: 30,
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
});
