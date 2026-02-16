// packages/mobile/components/proposals/ConfirmOrFeedback.tsx
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
} from "react-native";
import { Text, View } from "../Themed";

interface Props {
  onConfirm: () => void;
  onFeedback: (text: string) => void;
  confirmText?: string;
}

export function ConfirmOrFeedback({
  onConfirm,
  onFeedback,
  confirmText = "Proceed",
}: Props) {
  const colorScheme = useColorScheme() ?? "dark";
  const themeColors = Colors[colorScheme];
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = () => {
    setIsSubmitting(true);
    onConfirm();
  };

  const handleSubmitFeedback = () => {
    if (!feedbackText.trim()) return;
    setIsSubmitting(true);
    onFeedback(feedbackText);
    setFeedbackText("");
    setIsModalVisible(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.actions}>
        <Pressable
          style={[styles.button, styles.secondaryButton]}
          onPress={() => setIsModalVisible(true)}
          disabled={isSubmitting}
        >
          <Text
            style={[styles.secondaryButtonText, { color: themeColors.text }]}
          >
            💬 Feedback
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.button,
            { backgroundColor: themeColors.buttonPrimary },
          ]}
          onPress={handleConfirm}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.buttonText}>{confirmText}</Text>
          )}
        </Pressable>
      </View>

      <Modal visible={isModalVisible} transparent animationType="slide">
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
            <Text style={styles.modalTitle}>Provide Feedback</Text>
            <Text style={styles.modalSubtitle}>
              Tell the AI what you'd like to change.
            </Text>
            <TextInput
              style={[
                styles.input,
                { color: themeColors.text, borderColor: themeColors.tint },
              ]}
              value={feedbackText}
              onChangeText={setFeedbackText}
              placeholder="e.g. Make it more technical..."
              placeholderTextColor="#888"
              multiline
              autoFocus
            />
            <View style={styles.modalButtons}>
              <Pressable onPress={() => setIsModalVisible(false)}>
                <Text
                  style={{ color: "#888", marginRight: 25, fontWeight: "600" }}
                >
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={handleSubmitFeedback}
                disabled={!feedbackText.trim() || isSubmitting}
              >
                <Text
                  style={{
                    color: themeColors.tint,
                    fontWeight: "bold",
                    opacity: feedbackText.trim() ? 1 : 0.5,
                  }}
                >
                  Send to AI
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: "transparent" },
  actions: { flexDirection: "row", gap: 12, paddingTop: 10, paddingBottom: 20 },
  button: {
    flex: 1,
    height: 56,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  secondaryButton: { borderWidth: 1, borderColor: "rgba(128,128,128,0.3)" },
  secondaryButtonText: { fontWeight: "600", fontSize: 16 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalContent: {
    padding: 30,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    minHeight: 350,
  },
  modalTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 8 },
  modalSubtitle: { fontSize: 14, opacity: 0.6, marginBottom: 20 },
  input: {
    height: 120,
    borderWidth: 1,
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    textAlignVertical: "top",
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
  },
});
