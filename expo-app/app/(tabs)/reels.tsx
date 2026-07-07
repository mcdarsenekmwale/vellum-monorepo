import { useRef, useState } from "react";
import { Dimensions, FlatList, Image, Pressable, StyleSheet, Text, View, type ViewToken } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { reels } from "@/data/content";
import { colors, font } from "@/theme";


const { height } = Dimensions.get("window");

export default function Reels() {
  const router = useRouter();
  const [active, setActive] = useState(0);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]?.index != null) setActive(viewableItems[0].index);
  }).current;

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <FlatList
        data={reels}
        keyExtractor={(r) => r.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        renderItem={({ item, index }) => {
          const isLiked = !!liked[item.id];
          return (
            <View style={[styles.slide, { height }]}>
              <Image source={{ uri: item.cover }} style={StyleSheet.absoluteFillObject} />
              <View style={styles.gradient} />
              <View style={styles.side}>
                <Pressable
                  style={styles.sideBtn}
                  onPress={() => setLiked((s) => ({ ...s, [item.id]: !s[item.id] }))}
                >
                  <Ionicons name={isLiked ? "heart" : "heart-outline"} size={30} color={isLiked ? colors.accent : "#fff"} />
                  <Text style={styles.sideCount}>{item.likes + (isLiked ? 1 : 0)}</Text>
                </Pressable>
                <Pressable
                  style={styles.sideBtn}
                  onPress={() => router.push({ pathname: "/reels/[id]", params: { id: item.id } })}
                >
                  <Ionicons name="chatbubble-outline" size={28} color="#fff" />
                  <Text style={styles.sideCount}>Reply</Text>
                </Pressable>
                <Pressable style={styles.sideBtn}>
                  <Ionicons name="paper-plane-outline" size={28} color="#fff" />
                  <Text style={styles.sideCount}>Share</Text>
                </Pressable>
              </View>
              <Pressable
                style={styles.caption}
                onPress={() => router.push({ pathname: "/reels/[id]", params: { id: item.id } })}
              >
                <Text style={styles.handle}>{item.handle}</Text>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.index}>{index + 1} / {reels.length}{active === index ? "" : ""}</Text>
                <Text style={styles.openLink}>Tap to open comments →</Text>
              </Pressable>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  slide: { width: "100%", justifyContent: "flex-end" },
  gradient: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.25)" },
  side: { position: "absolute", right: 12, bottom: 120, alignItems: "center", gap: 20 },
  sideBtn: { alignItems: "center", gap: 4 },
  sideCount: { color: "#fff", fontSize: 11, fontWeight: "600" },
  caption: { padding: 20, paddingBottom: 120, gap: 4 },
  handle: { color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: "600" },
  title: { color: "#fff", fontFamily: font.display, fontSize: 22 },
  index: { color: "rgba(255,255,255,0.6)", fontSize: 10, marginTop: 4 },
});
