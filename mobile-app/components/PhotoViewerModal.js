import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import ImageView from 'react-native-image-viewing';
import { colors, spacing, typography, borderRadius, iconSizes } from '../styles/designTokens';

const PhotoViewerModal = ({
  visible,
  onClose,
  memory,
  onEdit,
  onDelete,
}) => {
  const [imageIndex, setImageIndex] = useState(0);
  const [actionSheetVisible, setActionSheetVisible] = useState(false);

  // Get the photo URL
  const getImageUrl = useCallback((photo) => {
    if (!photo) return null;
    
    if (photo.url) return photo.url;
    
    if (photo.publicId) {
      return `https://res.cloudinary.com/dtujkmf8d/image/upload/w_800,h_800,c_fill,q_auto,f_auto/${photo.publicId}`;
    }
    
    return null;
  }, []);

  const hasPhotos = memory?.photos && memory.photos.length > 0;
  const photos = memory?.photos || [];

  // Convert photos to format expected by react-native-image-viewing
  const images = useMemo(() => {
    return photos
      .map((photo) => {
        const url = getImageUrl(photo);
        return url ? { uri: url } : null;
      })
      .filter(Boolean);
  }, [photos, getImageUrl]);

  // Reset image index when memory changes
  useEffect(() => {
    if (visible && memory && photos.length > 0) {
      setImageIndex(0);
      setActionSheetVisible(false);
    }
  }, [visible, memory, photos]);

  const handleClose = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActionSheetVisible(false);
    onClose();
  }, [onClose]);

  const handleMenuPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActionSheetVisible(true);
  }, []);

  const handleEdit = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActionSheetVisible(false);
    onClose();
    onEdit();
  }, [onClose, onEdit]);

  const handleDelete = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActionSheetVisible(false);
    
    Alert.alert(
      'Delete Memory',
      'Are you sure you want to delete this memory? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            onDelete();
            onClose();
          }
        }
      ]
    );
  }, [onClose, onDelete]);

  // Header Component - Location above image with close and menu buttons
  const HeaderComponent = useCallback(({ imageIndex: currentIndex }) => {
    const venue = memory?.venue;
    let locationText = '';
    
    if (venue?.name) {
      locationText = venue.name;
    } else if (venue?.city && venue?.country) {
      locationText = `${venue.city}, ${venue.country}`;
    } else if (venue?.city) {
      locationText = venue.city;
    } else if (venue?.country) {
      locationText = venue.country;
    }

    return (
      <SafeAreaView edges={['top']} style={styles.headerOverlay}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            onPress={handleClose}
            style={styles.closeButton}
            accessibilityLabel="Close"
            accessibilityRole="button"
          >
            <MaterialIcons name="close" size={iconSizes.lg} color={colors.onPrimary} />
          </TouchableOpacity>
          
          {locationText ? (
            <View style={styles.locationContainer}>
              <Text style={styles.locationText} numberOfLines={1}>
                {locationText}
              </Text>
            </View>
          ) : (
            <View style={styles.locationContainer} />
          )}
          
          <TouchableOpacity
            onPress={handleMenuPress}
            style={styles.menuButton}
            accessibilityLabel="More options"
            accessibilityRole="button"
          >
            <MaterialIcons name="more-vert" size={iconSizes.lg} color={colors.onPrimary} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }, [memory, handleClose, handleMenuPress]);

  // Footer Component - Teams, score, date below image
  const FooterComponent = useCallback(({ imageIndex: currentIndex }) => {
    const homeTeam = memory?.homeTeam?.name || 'Unknown';
    const awayTeam = memory?.awayTeam?.name || 'Unknown';
    const score = memory?.userScore || memory?.apiMatchData?.officialScore || null;
    const date = memory?.date ? new Date(memory.date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }) : null;

    return (
      <View style={styles.footerOverlay}>
        <Text style={styles.teamsText}>
          {homeTeam} vs {awayTeam}
        </Text>
        {score && (
          <Text style={styles.scoreText}>{score}</Text>
        )}
        {date && (
          <Text style={styles.dateText}>{date}</Text>
        )}
      </View>
    );
  }, [memory]);

  if (!memory || !hasPhotos || images.length === 0) return null;

  return (
    <>
      <ImageView
        images={images}
        imageIndex={imageIndex}
        visible={visible}
        onRequestClose={handleClose}
        onImageIndexChange={setImageIndex}
        HeaderComponent={HeaderComponent}
        FooterComponent={FooterComponent}
        swipeToCloseEnabled={true}
        doubleTapToZoomEnabled={true}
        backgroundColor="#000000"
      />

      {/* Action Sheet Modal - Separate modal to work with ImageView */}
      <Modal
        visible={actionSheetVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setActionSheetVisible(false)}
        statusBarTranslucent={true}
      >
        <TouchableWithoutFeedback onPress={() => setActionSheetVisible(false)}>
          <View style={styles.actionSheetOverlayContainer}>
            <TouchableWithoutFeedback>
              <View style={styles.actionSheet}>
                <TouchableOpacity
                  style={styles.actionSheetItem}
                  onPress={handleEdit}
                  accessibilityLabel="Edit Memory"
                  accessibilityRole="button"
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="edit" size={iconSizes.md} color={colors.text.primary} />
                  <Text style={styles.actionSheetText}>Edit Memory</Text>
                </TouchableOpacity>
                
                <View style={styles.actionSheetDivider} />
                
                <TouchableOpacity
                  style={[styles.actionSheetItem, styles.actionSheetItemDestructive]}
                  onPress={handleDelete}
                  accessibilityLabel="Delete Memory"
                  accessibilityRole="button"
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="delete" size={iconSizes.md} color={colors.error} />
                  <Text style={[styles.actionSheetText, styles.actionSheetTextDestructive]}>
                    Delete Memory
                  </Text>
                </TouchableOpacity>
                
                <View style={styles.actionSheetDivider} />
                
                <TouchableOpacity
                  style={styles.actionSheetItem}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setActionSheetVisible(false);
                  }}
                  accessibilityLabel="Cancel"
                  accessibilityRole="button"
                  activeOpacity={0.7}
                >
                  <Text style={[styles.actionSheetText, styles.actionSheetTextCancel]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  headerOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    paddingTop: spacing.md,
  },
  locationContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  locationText: {
    ...typography.body,
    color: colors.onPrimary,
    fontFamily: typography.fontFamily,
  },
  closeButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 44,
    minHeight: 44,
  },
  menuButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 44,
    minHeight: 44,
  },
  footerOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    paddingBottom: spacing.lg,
  },
  teamsText: {
    ...typography.body,
    color: colors.onPrimary,
    fontFamily: typography.fontFamily,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  scoreText: {
    ...typography.bodySmall,
    color: colors.onPrimary,
    fontFamily: typography.fontFamily,
    marginBottom: spacing.xs,
  },
  dateText: {
    ...typography.bodySmall,
    color: colors.onPrimary,
    fontFamily: typography.fontFamily,
  },
  actionSheetOverlayContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  actionSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.card,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    paddingBottom: spacing.xl,
    paddingTop: spacing.md,
  },
  actionSheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  actionSheetItemDestructive: {
    // Destructive styling
  },
  actionSheetText: {
    ...typography.body,
    color: colors.text.primary,
    marginLeft: spacing.md,
    fontFamily: typography.fontFamily,
  },
  actionSheetTextDestructive: {
    color: colors.error,
  },
  actionSheetTextCancel: {
    textAlign: 'center',
    fontWeight: '600',
    marginLeft: 0,
  },
  actionSheetDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.xl,
  },
});

export default PhotoViewerModal;
