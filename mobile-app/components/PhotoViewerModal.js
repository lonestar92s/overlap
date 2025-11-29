import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Alert,
  Animated,
  Platform,
  ActionSheetIOS,
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
  const slideAnim = useRef(new Animated.Value(0)).current;
  // Store memory in ref to avoid stale closure issues
  const memoryRef = useRef(memory);
  
  // Update ref when memory changes
  useEffect(() => {
    memoryRef.current = memory;
    if (__DEV__) {
      console.log('Memory ref updated:', memory?.id || memory?._id);
    }
  }, [memory]);

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
      slideAnim.setValue(0);
    }
  }, [visible, memory, photos, slideAnim]);

  // Animate action sheet
  useEffect(() => {
    if (actionSheetVisible) {
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [actionSheetVisible, slideAnim]);

  const handleClose = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActionSheetVisible(false);
    onClose();
  }, [onClose]);

  const handleMenuPress = useCallback(() => {
    if (__DEV__) {
      console.log('handleMenuPress called, memory:', memory?.id || memory?._id);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (Platform.OS === 'ios') {
      // Use native ActionSheet on iOS
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Edit Memory', 'Delete Memory'],
          destructiveButtonIndex: 2,
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            handleEdit();
          } else if (buttonIndex === 2) {
            handleDelete();
          }
        }
      );
    } else {
      // Use custom bottom sheet on Android
      setActionSheetVisible(true);
    }
  }, [handleEdit, handleDelete, memory]);

  const handleEdit = useCallback(() => {
    // Get current memory value from ref to avoid stale closure issues
    const currentMemory = memoryRef.current || memory;
    if (__DEV__) {
      console.log('handleEdit called, memory from ref:', memoryRef.current?.id || memoryRef.current?._id);
      console.log('handleEdit called, memory from prop:', memory?.id || memory?._id);
      console.log('handleEdit called, currentMemory:', currentMemory?.id || currentMemory?._id);
    }
    
    if (!currentMemory) {
      if (__DEV__) {
        console.log('No memory available in handleEdit');
      }
      return;
    }
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActionSheetVisible(false);
    // Call onEdit immediately - it should handle navigation
    // Pass memory directly if onEdit accepts it, otherwise it will use selectedMemoryForViewer
    if (onEdit) {
      if (__DEV__) {
        console.log('Calling onEdit with memory:', currentMemory?.id || currentMemory?._id);
      }
      onEdit(currentMemory);
    } else {
      if (__DEV__) {
        console.log('onEdit is not defined');
      }
    }
  }, [onEdit, memory]);

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
    const stadiumName = venue?.name;
    
    // Build location text (city, country)
    let locationText = '';
    if (venue?.city && venue?.country) {
      locationText = `${venue.city}, ${venue.country}`;
    } else if (venue?.city) {
      locationText = venue.city;
    } else if (venue?.country) {
      locationText = venue.country;
    }
    
    const hasLocationInfo = stadiumName || locationText;

    return (
      <SafeAreaView edges={['top']} style={styles.headerOverlay} pointerEvents="box-none">
        <View style={styles.headerContent} pointerEvents="box-none">
          <TouchableOpacity
            onPress={handleClose}
            style={styles.closeButton}
            accessibilityLabel="Close"
            accessibilityRole="button"
            activeOpacity={0.7}
          >
            <MaterialIcons name="close" size={iconSizes.lg} color={colors.onPrimary} />
          </TouchableOpacity>
          
          {hasLocationInfo ? (
            <View style={styles.locationContainer} pointerEvents="none">
              {stadiumName && (
                <Text style={styles.stadiumNameText} numberOfLines={1}>
                  {stadiumName}
                </Text>
              )}
              {locationText && (
                <Text style={styles.locationText} numberOfLines={1}>
                  {locationText}
                </Text>
              )}
            </View>
          ) : (
            <View style={styles.locationContainer} pointerEvents="none" />
          )}
          
          <TouchableOpacity
            onPress={handleMenuPress}
            style={styles.menuButton}
            accessibilityLabel="More options"
            accessibilityRole="button"
            activeOpacity={0.7}
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
      <SafeAreaView edges={['bottom']} style={styles.footerOverlay}>
        <Text style={styles.teamsText}>
          {homeTeam} vs {awayTeam}
        </Text>
        {score && (
          <Text style={styles.scoreText}>{score}</Text>
        )}
        {date && (
          <Text style={styles.dateText}>{date}</Text>
        )}
      </SafeAreaView>
    );
  }, [memory]);

  // Log when memory changes
  useEffect(() => {
    console.log('PhotoViewerModal memory changed:', memory?.id || memory?._id, 'hasPhotos:', hasPhotos, 'images.length:', images.length);
  }, [memory, hasPhotos, images.length]);

  if (!memory || !hasPhotos || images.length === 0) {
    console.log('PhotoViewerModal returning null - memory:', !!memory, 'hasPhotos:', hasPhotos, 'images.length:', images.length);
    return null;
  }

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

      {/* Action Sheet - Use Modal for Android, native ActionSheet for iOS */}
      {Platform.OS === 'android' && (
        <Modal
          visible={visible && actionSheetVisible}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setActionSheetVisible(false)}
          statusBarTranslucent={true}
        >
          <View style={styles.actionSheetOverlayContainer} pointerEvents="box-none">
            <TouchableWithoutFeedback onPress={() => setActionSheetVisible(false)}>
              <View style={StyleSheet.absoluteFill} />
            </TouchableWithoutFeedback>
            <Animated.View 
              style={[
                styles.actionSheet,
                {
                  transform: [{
                    translateY: slideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [300, 0],
                    }),
                  }],
                },
              ]}
            >
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
          </Animated.View>
        </View>
      </Modal>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  headerOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingTop: spacing.lg,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    paddingTop: spacing.xxl,
  },
  locationContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  stadiumNameText: {
    ...typography.body,
    color: colors.onPrimary,
    fontFamily: typography.fontFamily,
    fontWeight: '600',
    marginBottom: spacing.xs / 2,
  },
  locationText: {
    ...typography.bodySmall,
    color: colors.onPrimary,
    fontFamily: typography.fontFamily,
    opacity: 0.9,
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
    paddingVertical: spacing.lg,
    paddingBottom: spacing.xxl,
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
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    zIndex: 10000,
    elevation: 10000,
  },
  actionSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    paddingBottom: spacing.xl,
    paddingTop: spacing.md,
    width: '100%',
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

