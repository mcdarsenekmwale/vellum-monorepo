import React from 'react';
import { View, Text, Image, TouchableWithoutFeedback } from 'react-native';

export interface MobileActivityGroup {
  id: string;
  kind: string;
  count: number;
  previewText: string | null;
  articleSlug: string | null;
  highlightId: string | null;
  commentId: string | null;
  linkHref: string | null;
  read: boolean;
  latestActivityAt: string;
  actors: Array<{
    id: string;
    handle?: string | null;
    name?: string | null;
    avatar?: string | null;
  }>;
  extraActorCount: number;
}

export function MobileActivityCard({
  item,
  onPress,
}: {
  item: MobileActivityGroup;
  onPress?: () => void;
}) {
  const displayedActors = item.actors.slice(0, 4);
  const overflowFromList = Math.max(0, item.actors.length - displayedActors.length);
  const extra = item.extraActorCount + overflowFromList;
  const rel = relativeLabel(item.latestActivityAt);

  return (
    <TouchableWithoutFeedback onPress={onPress}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          paddingHorizontal: 14,
          paddingVertical: 12,
          backgroundColor: '#FFFFFF',
          borderLeftWidth: 4,
          borderLeftColor: item.read ? 'transparent' : '#BAE6FD',
        }}
      >
        {/* Avatar cluster (left) */}
        <View style={{ flexDirection: 'row', width: 64, alignItems: 'center' }}>
          {displayedActors.map((a, i) => {
            const initial = (a.name || a.handle || '?')[0]?.toUpperCase() ?? '?';
            return (
              <View
                key={`${a.id}-${i}`}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  backgroundColor: '#E2E8F0',
                  marginLeft: i === 0 ? 0 : -10,
                  borderWidth: 2,
                  borderColor: '#FFFFFF',
                  zIndex: 10 - i,
                  overflow: 'hidden',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {a.avatar ? (
                  <Image
                    source={{ uri: a.avatar }}
                    style={{ width: 30, height: 30, borderRadius: 15 }}
                  />
                ) : (
                  <Text
                    style={{
                      fontSize: 11,
                      color: '#475569',
                      fontWeight: '700',
                    }}
                  >
                    {initial}
                  </Text>
                )}
              </View>
            );
          })}
          {extra > 0 && (
            <View
              style={{
                width: 30,
                height: 30,
                borderRadius: 15,
                marginLeft: -10,
                backgroundColor: '#0F172A',
                borderWidth: 2,
                borderColor: '#FFFFFF',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10 - displayedActors.length,
              }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '700' }}>
                +{extra}
              </Text>
            </View>
          )}
        </View>

        {/* Main content (middle) */}
        <View style={{ flex: 1, marginLeft: 4, minWidth: 0 }}>
          <Text
            numberOfLines={2}
            style={{
              color: '#0F172A',
              fontSize: 13,
              lineHeight: 18,
              fontWeight: item.read ? '400' : '600',
            }}
          >
            {item.previewText || 'New activity'}
          </Text>
          <Text
            style={{
              color: '#64748B',
              fontSize: 11,
              marginTop: 4,
            }}
          >
            {rel}
          </Text>
        </View>

        {/* Unread dot (right) */}
        {!item.read && (
          <View
            style={{
              marginTop: 6,
              marginLeft: 8,
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: '#0EA5E9',
            }}
          />
        )}
      </View>
    </TouchableWithoutFeedback>
  );
}

function relativeLabel(iso: string): string {
  try {
    const ms = Date.now() - new Date(iso).getTime();
    const m = Math.floor(ms / 60000);
    if (m < 1) return 'now';
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}d`;
    return new Date(iso).toLocaleDateString();
  } catch {
    return '';
  }
}
