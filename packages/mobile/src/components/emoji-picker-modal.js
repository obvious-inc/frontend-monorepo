import React from "react";
import {
  View,
  Text,
  KeyboardAvoidingView,
  FlatList,
  Pressable,
  Dimensions,
} from "react-native";
import * as Shades from "@shades/common";
import Input from "./input";
import theme from "../theme";

const { useCachedState } = Shades.app;
const { groupBy, indexBy } = Shades.utils.array;

const supportedEmojis = Shades.emoji.filter(
  (e) => parseFloat(e.unicode_version) < 13
);

const emojiByCategoryEntries = Object.entries(
  groupBy((e) => e.category, supportedEmojis)
);

const emojiByEmoji = indexBy((e) => e.emoji, supportedEmojis);

const windowWidth = Dimensions.get("window").width;
const emojiColumnCount = 7;
const emojiSize = Math.floor((windowWidth - 20) / emojiColumnCount);

const EmojiPickerModal = ({ onSelect }) => {
  const [recentEmoji] = useCachedState("recent-emoji", []);

  const [query, setQuery] = React.useState("");
  const trimmedQuery = React.useDeferredValue(query.trim());

  const data = React.useMemo(() => {
    const prepare = (entries) =>
      entries.reduce(
        (acc, [c, es]) => [
          ...acc,
          { id: c, title: c },
          { id: `${c}-items`, category: c, items: es },
        ],
        []
      );

    const emojiEntries =
      recentEmoji?.length > 0
        ? [
            [
              "Recently used",
              recentEmoji
                .slice(0, emojiColumnCount * 4) // 4 rows seems like a good max
                .map((e) => emojiByEmoji[e]),
            ],
            ...emojiByCategoryEntries,
          ]
        : emojiByCategoryEntries;

    if (trimmedQuery === "") return prepare(emojiEntries);

    const match = (e) =>
      [e.emoji, e.description.toLowerCase(), ...e.aliases, ...e.tags].some(
        (prop) => prop.includes(trimmedQuery)
      );

    const filteredEntries = emojiEntries.reduce((acc, [category, emoji]) => {
      const filteredEmoji = emoji.filter(match);
      if (filteredEmoji.length === 0) return acc;
      return [...acc, [category, filteredEmoji]];
    }, []);

    return prepare(filteredEntries);
  }, [trimmedQuery, recentEmoji]);

  return (
    <KeyboardAvoidingView
      behavior="padding"
      style={{
        flex: 1,
        backgroundColor: theme.colors.background,
      }}
    >
      <View
        style={{
          alignSelf: "center",
          width: 38,
          height: 5,
          borderRadius: 2.5,
          backgroundColor: "hsl(0,0%,32%)",
          marginTop: 4,
          marginBottom: 14,
        }}
      />
      <View style={{ paddingHorizontal: 16 }}>
        <Input
          placeholder="Search Emoji..."
          value={query}
          onChangeText={setQuery}
        />
      </View>

      <FlatList
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingTop: 10 }}
        stickyHeaderIndices={Array.from({ length: data.length / 2 }).map(
          (_, i) => i * 2
        )}
        renderItem={({ item }) => {
          const { title, items } = item;

          if (title)
            return (
              <View
                style={{
                  justifyContent: "flex-end",
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  backgroundColor: theme.colors.background,
                }}
              >
                <Text style={{ color: theme.colors.textDimmed }}>{title}</Text>
              </View>
            );

          return (
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                paddingHorizontal: 10,
              }}
            >
              {items.map((e) => (
                <Pressable
                  key={e.emoji}
                  onPress={() => {
                    onSelect(e);
                  }}
                  style={({ pressed }) => ({
                    width: emojiSize,
                    height: emojiSize,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 10,
                    backgroundColor: pressed
                      ? theme.colors.backgroundLight
                      : undefined,
                  })}
                >
                  <Text style={{ fontSize: 32 }}>{e.emoji}</Text>
                </Pressable>
              ))}
            </View>
          );
        }}
      />
    </KeyboardAvoidingView>
  );
};

export default EmojiPickerModal;
