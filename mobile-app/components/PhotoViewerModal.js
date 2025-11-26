import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  Dimensions,
  ActivityIndicator,
  TouchableWithoutFeedback,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, spacing, typography, borderRadius, iconSizes } from '../styles/designTokens';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const PhotoViewerModal = ({
  visible,
  onClose,
  memory,
  onEdit,
  onDelete,
}) => {
  const insets = useSafeAreaInsets();
  const [imageLoading, setImageLoading] = useState(true);
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
  const firstPhoto = hasPhotos ? memory.photos[0] : null;
  const imageUrl = getImageUrl(firstPhoto);
  const memoryTitle = memory?.matchTitle || memory?.teams || 'Memory';

  // Reset loading state when memory changes
  useEffect(() => {
    if (visible && memory) {
      setImageLoading(true);
      setActionSheetVisible(false);
    }
  }, [visible, memory]);

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

  const handleImageLoad = useCallback(() => {
    setImageLoading(false);
  }, []);

  const handleImageError = useCallback(() => {
    setImageLoading(false);
  }, []);

  if (!memory || !hasPhotos) return null;

  return (
    <>
      <Modal
        visible={visible}
        transparent={false}
        animationType="fade"
        onRequestClose={handleClose}
      >
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
          {/* Header */}
          <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.closeButton}
              accessibilityLabel="Close"
              accessibilityRole="button"
            >
              <MaterialIcons name="close" size={iconSizes.lg} color={colors.onPrimary} />
            </TouchableOpacity>
            
            <View style={styles.titleContainer}>
              <Text style={styles.title} numberOfLines={1}>
                {memoryTitle}
              </Text>
            </View>
            
            <TouchableOpacity
              onPress={handleMenuPress}
              style={styles.menuButton}
              accessibilityLabel="More options"
              accessibilityRole="button"
            >
              <MaterialIcons name="more-vert" size={iconSizes.lg} color={colors.onPrimary} />
            </TouchableOpacity>
          </View>

          {/* Photo Container */}
          <View style={styles.photoContainer}>
            {imageLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.onPrimary} />
              </View>
            )}
            {imageUrl ? (
              <Image
                source={{ uri: imageUrl }}
                style={styles.photo}
                resizeMode="contain"
                onLoad={handleImageLoad}
                onError={handleImageError}
                accessibilityLabel={`Photo for ${memoryTitle}`}
              />
            ) : (
              <View style={styles.errorContainer}>
                <MaterialIcons name="broken-image" size={iconSizes.xl} color={colors.text.light} />
                <Text style={styles.errorText}>Failed to load photo</Text>
              </View>
            )}
          </View>
        </SafeAreaView>
      </Modal>

      {/* Action Sheet Modal */}
      <Modal
        visible={actionSheetVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setActionSheetVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setActionSheetVisible(false)}>
          <View style={styles.actionSheetOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.actionSheet}>
                <TouchableOpacity
                  style={styles.actionSheetItem}
                  onPress={handleEdit}
                  accessibilityLabel="Edit Memory"
                  accessibilityRole="button"
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
                >
                  <MaterialIcons name="delete" size={iconSizes.md} color={colors.error} />
                  <Text style={[styles.actionSheetText, styles.actionSheetTextDestructive]}>
                    Delete Memory
                  </Text>
                </TouchableOpacity>
                
                <View style={styles.actionSheetDivider} />
                
                <TouchableOpacity
                  style={styles.actionSheetItem}
                  onPress={() => setActionSheetVisible(false)}
                  accessibilityLabel="Cancel"
                  accessibilityRole="button"
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
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  closeButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 44,
    minHeight: 44,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  title: {
    ...typography.body,
    color: colors.onPrimary,
    fontWeight: '600',
  },
  menuButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 44,
    minHeight: 44,
  },
  photoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  photo: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.7,
  },
  loadingContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    ...typography.body,
    color: colors.text.light,
    marginTop: spacing.md,
  },
  actionSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  actionSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    paddingBottom: spacing.xl,
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

