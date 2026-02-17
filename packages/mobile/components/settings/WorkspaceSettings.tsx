import { ThemeColors } from "@/constants/Colors";
import { useWorkspace } from "@/services/WorkspaceContext";
import { WorkspaceManager } from "@/services/WorkspaceManager";
import { computeSlug } from "@/utils/computeSlug";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { IoService } from "@hub-spoke/core";
import { Directory, Paths } from "expo-file-system";
import React, { useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet } from "react-native";
import { Text, View } from "../Themed";
import { InputField } from "../form/InputField";

interface Props {
  activeWorkspace: string | undefined;
  workspaces: string[];
  onRefresh: () => Promise<void>;
  themeColors: ThemeColors;
}

export function WorkspaceSettings({
  activeWorkspace,
  workspaces,
  onRefresh,
  themeColors,
}: Props) {
  const { switchWorkspace } = useWorkspace();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [newName, setNewName] = useState("");
  const displayedSlug = computeSlug(newName || "");

  const handleSwitch = async (id: string | undefined) => {
    await switchWorkspace(id);
    await onRefresh();
  };

  const handleCreate = async () => {
    const slug = newName.trim().toLowerCase().replace(/\s+/g, "-");
    if (!slug) return;

    try {
      const baseWorkspacesDir = new Directory(Paths.document, "workspaces");

      if (!baseWorkspacesDir.exists) {
        baseWorkspacesDir.create();
      }

      const workspaceRoot = new Directory(baseWorkspacesDir, slug);

      if (!workspaceRoot.exists) {
        workspaceRoot.create();
      }

      await IoService.initWorkspace(workspaceRoot.uri, "blank");
      await handleSwitch(slug);
      setIsModalVisible(false);
      setNewName("");
      await onRefresh();
    } catch (e: any) {
      console.log(e);
      Alert.alert("Error", e.message);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert("Delete Workspace", `Permanently delete "${id}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            if (activeWorkspace === id) {
              await handleSwitch(undefined);
            }

            const workspaceDir = WorkspaceManager.getWorkspaceUri(id);

            if (workspaceDir.exists) {
              await WorkspaceManager.deleteRecursively(workspaceDir.uri);
            }

            await onRefresh();
          } catch (error) {
            console.log(error);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <ScrollView style={{ flex: 1 }}>
        {workspaces.map((workspace) => (
          <View
            key={workspace}
            style={[
              styles.card,
              { backgroundColor: themeColors.cardBackground },
              activeWorkspace === workspace && styles.activeCard,
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.workspaceName}>{workspace}</Text>
              <Text style={styles.workspaceStatus}>
                {activeWorkspace === workspace ? "Active" : "Inactive"}
              </Text>
            </View>
            <View style={styles.workspaceActions}>
              <Pressable
                onPress={() => handleSwitch(workspace)}
                style={styles.workspaceIcon}
                disabled={activeWorkspace === workspace}
              >
                <FontAwesome
                  name="check-circle-o"
                  size={24}
                  color={themeColors.tint}
                />
              </Pressable>
              <Pressable
                onPress={() => handleDelete(workspace)}
                style={styles.workspaceIcon}
              >
                <FontAwesome name="trash" size={24} color="#ff4444" />
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>

      <Pressable
        style={[
          styles.actionButton,
          { backgroundColor: themeColors.buttonPrimary },
        ]}
        onPress={() => setIsModalVisible(true)}
      >
        <Text style={styles.buttonTextBold}>+ New Workspace</Text>
      </Pressable>

      <Modal visible={isModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: themeColors.modalBackground },
            ]}
          >
            <Text style={styles.modalTitle}>New Workspace</Text>
            <InputField
              label="Workspace ID"
              value={newName}
              onChangeText={setNewName}
              placeholder="workspace-slug"
              placeholderTextColor="#888"
              autoFocus
            />

            {(!displayedSlug || displayedSlug === newName) && (
              <Text
                style={{
                  marginTop: -16,
                  marginBottom: 28,
                  paddingHorizontal: 4,
                  fontSize: 13,
                  color: themeColors.text + "80",
                  fontStyle: "italic",
                  opacity: 0.7,
                }}
              >
                Enter the unique ID that will be used.
              </Text>
            )}

            {displayedSlug && displayedSlug !== newName && (
              <Text
                style={{
                  marginTop: -16,
                  marginBottom: 28,
                  paddingHorizontal: 4,
                  fontSize: 13,
                  color: themeColors.text + "80",
                  fontStyle: "italic",
                  opacity: 0.7,
                }}
              >
                Actual ID that will be used:{" "}
                <Text style={{ fontWeight: "600", color: themeColors.tint }}>
                  {displayedSlug}
                </Text>
              </Text>
            )}

            <View
              style={[
                styles.modalButtons,
                { backgroundColor: themeColors.modalBackground },
              ]}
            >
              <Pressable onPress={() => setIsModalVisible(false)}>
                <Text style={{ color: "#888", marginRight: 25 }}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleCreate}>
                <Text style={{ color: themeColors.tint, fontWeight: "bold" }}>
                  Create
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  card: {
    flexDirection: "row",
    padding: 20,
    borderRadius: 16,
    marginBottom: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "transparent",
    opacity: 0.6,
  },
  activeCard: { opacity: 1 },
  workspaceName: {
    fontSize: 18,
    fontWeight: "bold",
  },
  workspaceStatus: {
    fontSize: 12,
    color: "#888",
  },
  workspaceActions: { flexDirection: "row" },
  workspaceIcon: { marginLeft: 20 },
  actionButton: {
    height: 55,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  buttonTextBold: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: 30,
  },
  modalContent: { padding: 30, borderRadius: 25 },
  modalTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 15 },
  input: { height: 50, borderBottomWidth: 2, fontSize: 18, marginBottom: 30 },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
  },
});
