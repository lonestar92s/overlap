import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  PanGestureHandler,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { PanGestureHandler as GestureHandler } from 'react-native-gesture-handler';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Bottom sheet positions as percentages of screen height
const COLLAPSED_HEIGHT = 0.25;    // 25% of screen
const HALF_EXPANDED_HEIGHT = 0.55; // 55% of screen  
const FULL_EXPANDED_HEIGHT = 0.85; // 85% of screen

const BottomSheet = ({ 
  children,
  onStateChange = () => {},
  initialState = 'collapsed' // 'collapsed', 'half', 'full'
}) => {
  const [sheetState, setSheetState] = useState(initialState);
  const translateY = useRef(new Animated.Value(getTranslateY(initialState))).current;
  const gestureHandler = useRef();

  // Calculate translateY value for each state
  function getTranslateY(state) {
    switch (state) {
      case 'collapsed':
        return SCREEN_HEIGHT * (1 - COLLAPSED_HEIGHT);
      case 'half':
        return SCREEN_HEIGHT * (1 - HALF_EXPANDED_HEIGHT);
      case 'full':
        return SCREEN_HEIGHT * (1 - FULL_EXPANDED_HEIGHT);
      default:
        return SCREEN_HEIGHT * (1 - COLLAPSED_HEIGHT);
    }
  }

  // Animate to a specific state
  const animateToState = (targetState) => {
    const targetY = getTranslateY(targetState);
    
    Animated.spring(translateY, {
      toValue: targetY,
      damping: 20,
      mass: 1,
      stiffness: 100,
      overshootClamping: false,
      restSpeedThreshold: 0.1,
      restDisplacementThreshold: 0.1,
      useNativeDriver: true,
    }).start();

    setSheetState(targetState);
    onStateChange(targetState);
  };

  // Handle pan gesture
  const handleGestureEvent = Animated.event(
    [{ nativeEvent: { translationY: translateY } }],
    { useNativeDriver: true }
  );

  const handleGestureStateChange = (event) => {
    const { translationY, velocityY } = event.nativeEvent;
    const currentY = getTranslateY(sheetState) + translationY;

    // Determine target state based on position and velocity
    let targetState = sheetState;

    if (velocityY > 500) {
      // Fast downward swipe
      if (sheetState === 'full') targetState = 'half';
      else if (sheetState === 'half') targetState = 'collapsed';
    } else if (velocityY < -500) {
      // Fast upward swipe
      if (sheetState === 'collapsed') targetState = 'half';
      else if (sheetState === 'half') targetState = 'full';
    } else {
      // Slow movement - snap to nearest position
      const collapsedY = getTranslateY('collapsed');
      const halfY = getTranslateY('half');
      const fullY = getTranslateY('full');

      const distanceToCollapsed = Math.abs(currentY - collapsedY);
      const distanceToHalf = Math.abs(currentY - halfY);
      const distanceToFull = Math.abs(currentY - fullY);

      if (distanceToCollapsed < distanceToHalf && distanceToCollapsed < distanceToFull) {
        targetState = 'collapsed';
      } else if (distanceToHalf < distanceToFull) {
        targetState = 'half';
      } else {
        targetState = 'full';
      }
    }

    animateToState(targetState);
  };

  // Handle drag handle tap
  const handleDragHandleTap = () => {
    if (sheetState === 'collapsed') {
      animateToState('half');
    } else if (sheetState === 'half') {
      animateToState('full');
    } else {
      animateToState('collapsed');
    }
  };

  // Initialize position
  useEffect(() => {
    translateY.setValue(getTranslateY(initialState));
  }, []);

  return (
    <View style={styles.container} pointerEvents="box-none">
      <GestureHandler
        ref={gestureHandler}
        onGestureEvent={handleGestureEvent}
        onHandlerStateChange={handleGestureStateChange}
      >
        <Animated.View
          style={[
            styles.bottomSheet,
            {
              transform: [{ translateY }],
              height: SCREEN_HEIGHT,
            },
          ]}
        >
          {/* Drag Handle */}
          <TouchableOpacity 
            style={styles.dragHandleContainer}
            onPress={handleDragHandleTap}
            activeOpacity={0.7}
          >
            <View style={styles.dragHandle} />
          </TouchableOpacity>

          {/* Content */}
          <View style={styles.content}>
            {children}
          </View>
        </Animated.View>
      </GestureHandler>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  dragHandleContainer: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
});

export default BottomSheet; 