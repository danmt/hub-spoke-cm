// components/form/InputField.tsx
import { Text } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import { Colors } from "@/constants/Colors";
import React from "react";
import { StyleSheet, TextInput, TextInputProps, View } from "react-native";

export type InputVariant = "bordered" | "underline";

export interface InputFieldProps {
  label?: string;
  variant?: InputVariant;
  error?: string;
  required?: boolean;
  containerStyle?: object;
}

export function InputField({
  label,
  variant = "bordered",
  error,
  required = false,
  containerStyle,
  ...textInputProps
}: InputFieldProps & TextInputProps) {
  const colorScheme = useColorScheme() ?? "dark";
  const theme = Colors[colorScheme];

  const isError = !!error;

  const inputStyle = [
    styles.inputBase,
    variant === "bordered" && styles.inputBordered,
    variant === "underline" && styles.inputUnderline,
    {
      color: theme.text,
      borderColor: isError ? "#ff3b30" : "rgba(255,255,255,0.4)",
      backgroundColor:
        variant === "bordered" ? "rgba(255,255,255,0.08)" : "transparent",
    },
    textInputProps.multiline && {
      height: 96,
      textAlignVertical: "top" as const,
    },
    textInputProps.style,
  ];

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <View style={styles.labelRow}>
          <Text style={styles.label}>
            {label}
            {required && <Text style={styles.requiredStar}> *</Text>}
          </Text>
        </View>
      )}

      <TextInput
        {...textInputProps}
        style={inputStyle}
        value={textInputProps.value}
        onChangeText={textInputProps.onChangeText}
        placeholder={textInputProps.placeholder}
        placeholderTextColor="#888"
        multiline={textInputProps.multiline}
      />

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: "900",
    opacity: 0.7,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  requiredStar: {
    color: "#ff3b30",
    fontWeight: "bold",
  },
  inputBase: {
    fontSize: 17,
    paddingVertical: 12,
  },
  inputBordered: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  inputUnderline: {
    borderBottomWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 2,
  },
  errorText: {
    marginTop: 6,
    fontSize: 13,
    color: "#ff3b30",
    fontWeight: "500",
  },
});
